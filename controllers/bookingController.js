import connection from "../database.js";

import { handleServerError } from "../utils/errorHandler.js";
import { isNotEmpty, isInEnum } from "../utils/validation.js";

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

    const booking_code = `RVN-${Date.now()}`;

    // AUTO ASSIGN MECHANIC
    const [mechanics] = await connection.execute(`
      SELECT
        users.id,
        users.name,

        COUNT(bookings.id) AS active_jobs

      FROM users

      LEFT JOIN bookings
        ON users.id = bookings.mechanic_id
        AND bookings.status IN (
          'accepted',
          'inspection',
          'in_progress'
        )

      WHERE users.role = 'mechanic'
      AND users.availability = 'available'

      GROUP BY users.id

      ORDER BY active_jobs ASC

      LIMIT 1
    `);

    if (mechanics.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Tidak ada mechanic available",
      });
    }

    const selectedMechanic = mechanics[0];

    // SET MECHANIC BUSY
    await connection.execute(
      `
      UPDATE users
      SET availability = 'busy'
      WHERE id = ?
      `,
      [selectedMechanic.id],
    );

    // INSERT BOOKING
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
        selectedMechanic.id,
        preferred_date,
        preferred_time,
        complaint,
        priority || "medium",
        "accepted",
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

    return res.status(201).json({
      success: true,
      message: "Booking berhasil dibuat",

      data: {
        booking_id,
        booking_code,

        assigned_mechanic: {
          id: selectedMechanic.id,
          name: selectedMechanic.name,
        },

        status: "accepted",
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
    const { search = "", status, priority, page = 1, limit = 10 } = req.query;

    const offset = (page - 1) * limit;

    let query = `
      SELECT
        bookings.*,

        users.name AS customer_name,
        users.email AS customer_email,

        vehicles.brand,
        vehicles.model,

        services.name AS service_name,

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

    // SEARCH
    if (search) {
      query += `
        AND (
          bookings.booking_code LIKE ?
          OR users.name LIKE ?
          OR vehicles.brand LIKE ?
          OR vehicles.model LIKE ?
        )
      `;

      values.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    // FILTER STATUS
    if (status) {
      query += ` AND bookings.status = ? `;
      values.push(status);
    }

    // FILTER PRIORITY
    if (priority) {
      query += ` AND bookings.priority = ? `;
      values.push(priority);
    }

    // ORDER + PAGINATION
    query += `
      ORDER BY bookings.created_at DESC
      LIMIT ?
      OFFSET ?
    `;

    values.push(Number(limit), Number(offset));

    const [bookings] = await connection.execute(query, values);

    // TOTAL DATA
    let totalQuery = `
      SELECT COUNT(*) AS total

      FROM bookings

      JOIN users
        ON bookings.user_id = users.id

      JOIN vehicles
        ON bookings.vehicle_id = vehicles.id

      WHERE 1=1
    `;

    const totalValues = [];

    if (search) {
      totalQuery += `
        AND (
          bookings.booking_code LIKE ?
          OR users.name LIKE ?
          OR vehicles.brand LIKE ?
          OR vehicles.model LIKE ?
        )
      `;

      totalValues.push(
        `%${search}%`,
        `%${search}%`,
        `%${search}%`,
        `%${search}%`,
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

      pagination: {
        current_page: Number(page),
        limit: Number(limit),
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

    if (req.user.role === "mechanic" && booking.mechanic_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Forbidden",
      });
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

    await connection.execute(
      `
      UPDATE bookings
      SET status = ?
      WHERE id = ?
      `,
      [status, id],
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

    await connection.execute(
      `
      DELETE FROM bookings
      WHERE id = ?
      `,
      [id],
    );

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
      AND bookings.status IN (
        'accepted',
        'inspection',
        'in_progress'
      )
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

    query += ` ORDER BY bookings.created_at DESC `;

    const [bookings] = await connection.execute(query, values);

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
