import connection from "../database.js";

import { handleServerError } from "../utils/errorHandler.js";
import { isNotEmpty, isInEnum } from "../utils/validation.js";

import {
  createNotification,
  createBulkNotifications,
} from "../utils/notificationHelper.js";

const bookingStatusList = [
  "pending",
  "accepted",
  "inspection",
  "in_progress",
  "completed",
  "cancelled",
];

const formatStatusText = (status) => {
  return String(status || "").replace("_", " ");
};

const getSuperAdmins = async () => {
  const [superAdmins] = await connection.execute(
    `
    SELECT id
    FROM users
    WHERE role = 'super_admin'
    `,
  );

  return superAdmins;
};

const activeBookingStatusList = ["accepted", "inspection", "in_progress"];

const getMechanicActiveBooking = async (mechanicId) => {
  const [bookings] = await connection.execute(
    `
    SELECT id, booking_code, status
    FROM bookings
    WHERE mechanic_id = ?
    AND status IN ('accepted', 'inspection', 'in_progress')
    LIMIT 1
    `,
    [mechanicId],
  );

  return bookings[0] || null;
};

const syncMechanicAvailabilityAfterBookingDone = async (mechanicId) => {
  const activeBooking = await getMechanicActiveBooking(mechanicId);

  if (activeBooking) {
    await connection.execute(
      `
      UPDATE users
      SET availability = 'busy'
      WHERE id = ?
      AND role = 'mechanic'
      `,
      [mechanicId],
    );

    return "busy";
  }

  await connection.execute(
    `
    UPDATE users
    SET availability = 'available'
    WHERE id = ?
    AND role = 'mechanic'
    `,
    [mechanicId],
  );

  return "available";
};

// CREATE BOOKING
export const createBooking = async (req, res) => {
  try {
    const {
      vehicle_id,
      service_id,
      preferred_date,
      preferred_time,
      complaint,
      priority,
    } = req.body;

    const user_id = req.user.id;

    // VALIDATION
    if (
      !isNotEmpty(vehicle_id) ||
      !isNotEmpty(service_id) ||
      !isNotEmpty(preferred_date) ||
      !isNotEmpty(preferred_time) ||
      !isNotEmpty(complaint)
    ) {
      return res.status(400).json({
        success: false,
        message: "Semua field wajib diisi",
      });
    }

    if (priority && !isInEnum(priority, ["low", "medium", "high"])) {
      return res.status(400).json({
        success: false,
        message: "Priority tidak valid",
      });
    }

    // CHECK VEHICLE
    const [vehicles] = await connection.execute(
      `
      SELECT *
      FROM vehicles
      WHERE id = ?
      AND user_id = ?
      `,
      [vehicle_id, user_id],
    );

    if (vehicles.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Vehicle tidak ditemukan",
      });
    }

    const vehicle = vehicles[0];

    // CHECK SERVICE
    const [services] = await connection.execute(
      `
      SELECT *
      FROM services
      WHERE id = ?
      `,
      [service_id],
    );

    if (services.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Service tidak ditemukan",
      });
    }

    const service = services[0];

    const booking_code = `RVN-${Date.now()}`;

    // INSERT BOOKING AS PENDING
    const [result] = await connection.execute(
      `
      INSERT INTO bookings
      (
        booking_code,
        user_id,
        vehicle_id,
        service_id,
        mechanic_id,
        preferred_date,
        preferred_time,
        complaint,
        priority,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        booking_code,
        user_id,
        vehicle_id,
        service_id,
        null,
        preferred_date,
        preferred_time,
        complaint,
        priority || "medium",
        "pending",
      ],
    );

    const booking_id = result.insertId;

    // SAVE IMAGES
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        await connection.execute(
          `
          INSERT INTO booking_images
          (
            booking_id,
            image
          )
          VALUES (?, ?)
          `,
          [booking_id, file.filename],
        );
      }
    }

    // NOTIFY AVAILABLE MECHANICS
    const [mechanics] = await connection.execute(
      `
      SELECT id
      FROM users
      WHERE role = 'mechanic'
      AND availability = 'available'
      `,
    );

    await createBulkNotifications(
      mechanics.map((mechanic) => ({
        user_id: mechanic.id,
        title: "New Booking Request",
        message: `A customer submitted a new ${service.name} booking request for ${vehicle.brand} ${vehicle.model}.`,
        type: "booking",
        reference_id: booking_id,
        reference_url: "/mechanics/bookings",
      })),
    );

    // NOTIFY SUPER ADMINS
    const superAdmins = await getSuperAdmins();

    await createBulkNotifications(
      superAdmins.map((admin) => ({
        user_id: admin.id,
        title: "New Customer Booking",
        message: `New booking ${booking_code} has been submitted by a customer.`,
        type: "booking",
        reference_id: booking_id,
        reference_url: `/super_admin/bookings/${booking_id}`,
      })),
    );

    return res.status(201).json({
      success: true,
      message: "Booking berhasil dibuat dan menunggu mechanic menerima",

      data: {
        booking_id,
        booking_code,
        assigned_mechanic: null,
        status: "pending",
      },
    });
  } catch (err) {
    return handleServerError(res, err, "CREATE_BOOKING_ERROR");
  }
};

// GET MY BOOKINGS
export const getMyBookings = async (req, res) => {
  try {
    const user_id = req.user.id;

    const { status, search } = req.query;

    let query = `
      SELECT
        bookings.*,

        vehicles.brand,
        vehicles.model,

        services.name AS service_name,

        mechanics.name AS mechanic_name

      FROM bookings

      JOIN vehicles
        ON bookings.vehicle_id = vehicles.id

      JOIN services
        ON bookings.service_id = services.id

      LEFT JOIN users AS mechanics
        ON bookings.mechanic_id = mechanics.id

      WHERE bookings.user_id = ?
    `;

    const values = [user_id];

    if (status) {
      query += ` AND bookings.status = ? `;
      values.push(status);
    }

    if (search) {
      query += `
        AND (
          bookings.booking_code LIKE ?
          OR vehicles.brand LIKE ?
          OR vehicles.model LIKE ?
          OR services.name LIKE ?
        )
      `;

      const keyword = `%${search}%`;

      values.push(keyword, keyword, keyword, keyword);
    }

    query += ` ORDER BY bookings.created_at DESC `;

    const [bookings] = await connection.execute(query, values);

    return res.json({
      success: true,
      total: bookings.length,
      data: bookings,
    });
  } catch (err) {
    return handleServerError(res, err, "GET_MY_BOOKINGS_ERROR");
  }
};

// GET MECHANIC BOOKINGS
export const getMechanicBookings = async (req, res) => {
  try {
    const mechanic_id = req.user.id;

    const { status, search } = req.query;

    let query = `
      SELECT
        bookings.*,

        users.name AS customer_name,
        users.email AS customer_email,

        vehicles.brand,
        vehicles.model,
        vehicles.license_plate,

        services.name AS service_name

      FROM bookings

      JOIN users
        ON bookings.user_id = users.id

      JOIN vehicles
        ON bookings.vehicle_id = vehicles.id

      JOIN services
        ON bookings.service_id = services.id

      WHERE bookings.mechanic_id = ?
    `;

    const values = [mechanic_id];

    if (status) {
      query += ` AND bookings.status = ? `;
      values.push(status);
    }

    if (search) {
      query += `
        AND (
          bookings.booking_code LIKE ?
          OR users.name LIKE ?
          OR vehicles.brand LIKE ?
          OR vehicles.model LIKE ?
        )
      `;

      const keyword = `%${search}%`;

      values.push(keyword, keyword, keyword, keyword);
    }

    query += ` ORDER BY bookings.created_at DESC `;

    const [bookings] = await connection.execute(query, values);

    return res.json({
      success: true,
      total: bookings.length,
      data: bookings,
    });
  } catch (err) {
    return handleServerError(res, err, "GET_MECHANIC_BOOKINGS_ERROR");
  }
};

// GET ALL BOOKINGS
export const getAllBookings = async (req, res) => {
  try {
    const { search = "", status, priority } = req.query;

    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.max(parseInt(req.query.limit || "10", 10), 1);
    const offset = (page - 1) * limit;

    let query = `
      SELECT
        bookings.*,

        users.name AS customer_name,
        users.email AS customer_email,

        vehicles.brand,
        vehicles.model,
        vehicles.license_plate,

        services.name AS service_name,
        services.price,

        mechanics.name AS mechanic_name

      FROM bookings

      JOIN users
        ON bookings.user_id = users.id

      JOIN vehicles
        ON bookings.vehicle_id = vehicles.id

      JOIN services
        ON bookings.service_id = services.id

      LEFT JOIN users AS mechanics
        ON bookings.mechanic_id = mechanics.id

      WHERE 1=1
    `;

    const values = [];

    if (search) {
      query += `
        AND (
          bookings.booking_code LIKE ?
          OR users.name LIKE ?
          OR users.email LIKE ?
          OR vehicles.brand LIKE ?
          OR vehicles.model LIKE ?
          OR vehicles.license_plate LIKE ?
          OR services.name LIKE ?
          OR mechanics.name LIKE ?
        )
      `;

      const keyword = `%${search}%`;

      values.push(
        keyword,
        keyword,
        keyword,
        keyword,
        keyword,
        keyword,
        keyword,
        keyword,
      );
    }

    if (status) {
      query += ` AND bookings.status = ? `;
      values.push(status);
    }

    if (priority) {
      query += ` AND bookings.priority = ? `;
      values.push(priority);
    }

    query += `
      ORDER BY bookings.created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const [bookings] = await connection.execute(query, values);

    let totalQuery = `
      SELECT COUNT(*) AS total

      FROM bookings

      JOIN users
        ON bookings.user_id = users.id

      JOIN vehicles
        ON bookings.vehicle_id = vehicles.id

      JOIN services
        ON bookings.service_id = services.id

      LEFT JOIN users AS mechanics
        ON bookings.mechanic_id = mechanics.id

      WHERE 1=1
    `;

    const totalValues = [];

    if (search) {
      totalQuery += `
        AND (
          bookings.booking_code LIKE ?
          OR users.name LIKE ?
          OR users.email LIKE ?
          OR vehicles.brand LIKE ?
          OR vehicles.model LIKE ?
          OR vehicles.license_plate LIKE ?
          OR services.name LIKE ?
          OR mechanics.name LIKE ?
        )
      `;

      const keyword = `%${search}%`;

      totalValues.push(
        keyword,
        keyword,
        keyword,
        keyword,
        keyword,
        keyword,
        keyword,
        keyword,
      );
    }

    if (status) {
      totalQuery += ` AND bookings.status = ? `;
      totalValues.push(status);
    }

    if (priority) {
      totalQuery += ` AND bookings.priority = ? `;
      totalValues.push(priority);
    }

    const [[totalData]] = await connection.execute(totalQuery, totalValues);

    return res.json({
      success: true,
      total: totalData.total,

      pagination: {
        current_page: page,
        limit,
        total_data: totalData.total,
        total_page: Math.ceil(totalData.total / limit),
      },

      data: bookings,
    });
  } catch (err) {
    return handleServerError(res, err, "GET_ALL_BOOKINGS_ERROR");
  }
};

// GET BOOKING BY ID
export const getBookingById = async (req, res) => {
  try {
    const { id } = req.params;

    const [bookings] = await connection.execute(
      `
      SELECT
        bookings.*,

        users.name AS customer_name,
        users.email AS customer_email,

        vehicles.brand,
        vehicles.model,
        vehicles.license_plate,

        services.name AS service_name,
        services.price,

        mechanics.name AS mechanic_name

      FROM bookings

      JOIN users
        ON bookings.user_id = users.id

      JOIN vehicles
        ON bookings.vehicle_id = vehicles.id

      JOIN services
        ON bookings.service_id = services.id

      LEFT JOIN users AS mechanics
        ON bookings.mechanic_id = mechanics.id

      WHERE bookings.id = ?
      `,
      [id],
    );

    if (bookings.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Booking tidak ditemukan",
      });
    }

    const booking = bookings[0];

    if (req.user.role === "customer" && booking.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Forbidden",
      });
    }

    if (req.user.role === "mechanic") {
      const isAssignedToMechanic = booking.mechanic_id === req.user.id;
      const isPendingUnassigned =
        booking.status === "pending" && booking.mechanic_id === null;

      if (!isAssignedToMechanic && !isPendingUnassigned) {
        return res.status(403).json({
          success: false,
          message: "Forbidden",
        });
      }
    }

    const [images] = await connection.execute(
      `
      SELECT *
      FROM booking_images
      WHERE booking_id = ?
      AND progress_id IS NULL
      `,
      [id],
    );

    const formattedImages = images.map((img) => ({
      id: img.id,
      image: img.image,

      image_url: `${req.protocol}://${req.get("host")}/uploads/${img.image}`,
    }));

    return res.json({
      success: true,

      data: {
        ...booking,
        images: formattedImages,
      },
    });
  } catch (err) {
    return handleServerError(res, err, "GET_BOOKING_BY_ID_ERROR");
  }
};

// UPDATE BOOKING STATUS
export const updateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !bookingStatusList.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status booking tidak valid",
      });
    }

    const [bookings] = await connection.execute(
      `
      SELECT
        bookings.*,
        services.name AS service_name
      FROM bookings
      JOIN services
        ON bookings.service_id = services.id
      WHERE bookings.id = ?
      `,
      [id],
    );

    if (bookings.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Booking tidak ditemukan",
      });
    }

    const booking = bookings[0];

    if (req.user.role === "customer") {
      return res.status(403).json({
        success: false,
        message: "Customer tidak dapat mengubah status booking",
      });
    }

    if (req.user.role === "mechanic" && booking.mechanic_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Mechanic hanya dapat mengubah booking miliknya",
      });
    }

    await connection.execute(
      `
      UPDATE bookings
      SET status = ?
      WHERE id = ?
      `,
      [status, id],
    );

    if (
      (status === "completed" || status === "cancelled") &&
      booking.mechanic_id
    ) {
      await syncMechanicAvailabilityAfterBookingDone(booking.mechanic_id);
    }

    const statusText = formatStatusText(status);

    // NOTIFY CUSTOMER
    await createNotification({
      user_id: booking.user_id,
      title: "Booking Status Updated",
      message: `Your booking ${booking.booking_code} status has been updated to ${statusText}.`,
      type: "booking_status",
      reference_id: booking.id,
      reference_url: `/customers/bookings/${booking.id}`,
    });

    // NOTIFY MECHANIC IF STATUS UPDATED BY SUPER ADMIN
    if (
      req.user.role === "super_admin" &&
      booking.mechanic_id &&
      booking.mechanic_id !== req.user.id
    ) {
      await createNotification({
        user_id: booking.mechanic_id,
        title: "Booking Status Updated",
        message: `Booking ${booking.booking_code} status has been updated to ${statusText}.`,
        type: "booking_status",
        reference_id: booking.id,
        reference_url: `/mechanics/bookings/${booking.id}`,
      });
    }

    // NOTIFY SUPER ADMINS
    const superAdmins = await getSuperAdmins();

    await createBulkNotifications(
      superAdmins
        .filter((admin) => admin.id !== req.user.id)
        .map((admin) => ({
          user_id: admin.id,
          title: "Booking Status Updated",
          message: `Booking ${booking.booking_code} status changed to ${statusText}.`,
          type: "booking_status",
          reference_id: booking.id,
          reference_url: `/super_admin/bookings/${booking.id}`,
        })),
    );

    return res.json({
      success: true,
      message: "Status booking berhasil diupdate",
    });
  } catch (err) {
    return handleServerError(res, err, "UPDATE_BOOKING_STATUS_ERROR");
  }
};

// DELETE BOOKING
export const deleteBooking = async (req, res) => {
  try {
    const { id } = req.params;

    const [bookings] = await connection.execute(
      `
      SELECT *
      FROM bookings
      WHERE id = ?
      `,
      [id],
    );

    if (bookings.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Booking tidak ditemukan",
      });
    }

    const booking = bookings[0];

    await connection.execute(
      `
      DELETE FROM bookings
      WHERE id = ?
      `,
      [id],
    );

    if (booking.mechanic_id) {
      await syncMechanicAvailabilityAfterBookingDone(booking.mechanic_id);
    }
    await createNotification({
      user_id: booking.user_id,
      title: "Booking Deleted",
      message: `Your booking ${booking.booking_code} has been deleted by admin.`,
      type: "booking",
      reference_id: booking.id,
      reference_url: "/customers/bookings",
    });

    return res.json({
      success: true,
      message: "Booking berhasil dihapus",
    });
  } catch (err) {
    return handleServerError(res, err, "DELETE_BOOKING_ERROR");
  }
};

// GET MECHANIC INCOMING BOOKINGS
export const getMechanicIncomingBookings = async (req, res) => {
  try {
    const mechanic_id = req.user.id;

    const [bookings] = await connection.execute(
      `
      SELECT
        bookings.*,

        users.name AS customer_name,
        users.email AS customer_email,

        vehicles.brand,
        vehicles.model,
        vehicles.license_plate,

        services.name AS service_name,
        services.price

      FROM bookings

      JOIN users
        ON bookings.user_id = users.id

      JOIN vehicles
        ON bookings.vehicle_id = vehicles.id

      JOIN services
        ON bookings.service_id = services.id

      WHERE
        (
          bookings.status = 'pending'
          AND bookings.mechanic_id IS NULL
        )
        OR
        (
          bookings.mechanic_id = ?
          AND bookings.status IN ('accepted', 'inspection', 'in_progress')
        )

      ORDER BY bookings.created_at DESC
      `,
      [mechanic_id],
    );

    return res.json({
      success: true,
      total: bookings.length,
      data: bookings,
    });
  } catch (err) {
    return handleServerError(res, err, "GET_MECHANIC_INCOMING_BOOKINGS_ERROR");
  }
};

// GET MECHANIC COMPLETED BOOKINGS
export const getMechanicCompletedBookings = async (req, res) => {
  try {
    const mechanic_id = req.user.id;

    const { search } = req.query;

    let query = `
      SELECT
        bookings.*,

        users.name AS customer_name,
        users.email AS customer_email,

        vehicles.brand,
        vehicles.model,
        vehicles.license_plate,

        services.name AS service_name

      FROM bookings

      JOIN users
        ON bookings.user_id = users.id

      JOIN vehicles
        ON bookings.vehicle_id = vehicles.id

      JOIN services
        ON bookings.service_id = services.id

      WHERE bookings.mechanic_id = ?
      AND bookings.status = 'completed'
    `;

    const values = [mechanic_id];

    if (search) {
      query += `
        AND (
          bookings.booking_code LIKE ?
          OR users.name LIKE ?
          OR vehicles.brand LIKE ?
          OR vehicles.model LIKE ?
        )
      `;

      const keyword = `%${search}%`;

      values.push(keyword, keyword, keyword, keyword);
    }

    query += ` ORDER BY bookings.updated_at DESC `;

    const [bookings] = await connection.execute(query, values);

    return res.json({
      success: true,
      total: bookings.length,
      data: bookings,
    });
  } catch (err) {
    return handleServerError(res, err, "GET_MECHANIC_COMPLETED_BOOKINGS_ERROR");
  }
};

// ACCEPT BOOKING BY MECHANIC
export const acceptBookingByMechanic = async (req, res) => {
  try {
    const { id } = req.params;
    const mechanic_id = req.user.id;

    const [mechanics] = await connection.execute(
      `
      SELECT id, role, availability, name
      FROM users
      WHERE id = ?
      AND role = 'mechanic'
      `,
      [mechanic_id],
    );

    if (mechanics.length === 0) {
      return res.status(403).json({
        success: false,
        message: "Hanya mechanic yang dapat menerima booking",
      });
    }

    const mechanic = mechanics[0];

    if (mechanic.availability !== "available") {
      return res.status(400).json({
        success: false,
        message:
          mechanic.availability === "busy"
            ? "Mechanic sedang menangani booking lain"
            : "Mechanic sedang off duty",
      });
    }

    const activeBooking = await getMechanicActiveBooking(mechanic_id);

    if (activeBooking) {
      await connection.execute(
        `
    UPDATE users
    SET availability = 'busy'
    WHERE id = ?
    AND role = 'mechanic'
    `,
        [mechanic_id],
      );

      return res.status(400).json({
        success: false,
        message: "Mechanic hanya bisa menangani 1 booking aktif",
        active_booking: activeBooking,
      });
    }

    const [bookings] = await connection.execute(
      `
      SELECT *
      FROM bookings
      WHERE id = ?
      `,
      [id],
    );

    if (bookings.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Booking tidak ditemukan",
      });
    }

    const booking = bookings[0];

    if (booking.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Booking sudah tidak berstatus pending",
      });
    }

    if (booking.mechanic_id !== null) {
      return res.status(400).json({
        success: false,
        message: "Booking sudah diterima mechanic lain",
      });
    }

    await connection.execute(
      `
      UPDATE bookings
      SET
        mechanic_id = ?,
        status = 'accepted'
      WHERE id = ?
      `,
      [mechanic_id, id],
    );

    await connection.execute(
      `
      UPDATE users
      SET availability = 'busy'
      WHERE id = ?
      `,
      [mechanic_id],
    );

    // NOTIFY CUSTOMER
    await createNotification({
      user_id: booking.user_id,
      title: "Booking Accepted",
      message: `Your booking ${booking.booking_code} has been accepted by ${mechanic.name}.`,
      type: "booking_status",
      reference_id: booking.id,
      reference_url: `/customers/bookings/${booking.id}`,
    });

    // NOTIFY SUPER ADMINS
    const superAdmins = await getSuperAdmins();

    await createBulkNotifications(
      superAdmins.map((admin) => ({
        user_id: admin.id,
        title: "Booking Accepted by Mechanic",
        message: `Booking ${booking.booking_code} has been accepted by ${mechanic.name}.`,
        type: "booking_status",
        reference_id: booking.id,
        reference_url: `/super_admin/bookings/${booking.id}`,
      })),
    );

    return res.json({
      success: true,
      message: "Booking berhasil diterima",
    });
  } catch (err) {
    return handleServerError(res, err, "ACCEPT_BOOKING_BY_MECHANIC_ERROR");
  }
};
