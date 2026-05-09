import connection from "../database.js";

import { handleServerError } from "../utils/errorHandler.js";

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

    const booking_code = `RVN-${Date.now()}`;

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

export const getMyBookings = async (req, res) => {
  try {
    const user_id = req.user.id;

    const [bookings] = await connection.execute(
      `
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

      ORDER BY bookings.created_at DESC
      `,
      [user_id],
    );

    return res.json({
      success: true,
      data: bookings,
    });
  } catch (err) {
    return handleServerError(res, err, "GET_MY_BOOKINGS_ERROR");
  }
};

export const getMechanicBookings = async (req, res) => {
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

        services.name AS service_name

      FROM bookings

      JOIN users
        ON bookings.user_id = users.id

      JOIN vehicles
        ON bookings.vehicle_id = vehicles.id

      JOIN services
        ON bookings.service_id = services.id

      WHERE bookings.mechanic_id = ?

      ORDER BY bookings.created_at DESC
      `,
      [mechanic_id],
    );

    return res.json({
      success: true,
      data: bookings,
    });
  } catch (err) {
    return handleServerError(res, err, "GET_MECHANIC_BOOKINGS_ERROR");
  }
};

export const getAllBookings = async (req, res) => {
  try {
    const [bookings] = await connection.execute(`
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

      ORDER BY bookings.created_at DESC
    `);

    return res.json({
      success: true,
      data: bookings,
    });
  } catch (err) {
    return handleServerError(res, err, "GET_ALL_BOOKINGS_ERROR");
  }
};

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
