import connection from "../database.js";

import { handleServerError } from "../utils/errorHandler.js";

export const createBookingProgress = async (req, res) => {
  try {
    const { booking_id, status, notes } = req.body;

    const updated_by = req.user.id;

    const image = req.file ? req.file.filename : null;

    const [bookings] = await connection.execute(
      `
      SELECT *
      FROM bookings
      WHERE id = ?
      `,
      [booking_id],
    );

    if (bookings.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Booking tidak ditemukan",
      });
    }

    await connection.execute(
      `
      INSERT INTO booking_progress
      (
        booking_id,
        status,
        notes,
        image,
        updated_by
      )
      VALUES (?, ?, ?, ?, ?)
      `,
      [booking_id, status, notes, image, updated_by],
    );

    await connection.execute(
      `
      UPDATE bookings
      SET status = ?
      WHERE id = ?
      `,
      [status, booking_id],
    );

    return res.status(201).json({
      success: true,
      message: "Progress booking berhasil ditambahkan",

      image_url: image
        ? `${req.protocol}://${req.get("host")}/uploads/${image}`
        : null,
    });
  } catch (err) {
    return handleServerError(res, err, "CREATE_BOOKING_PROGRESS_ERROR");
  }
};

export const getBookingProgressByBookingId = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const [bookings] = await connection.execute(
      `
      SELECT *
      FROM bookings
      WHERE id = ?
      `,
      [bookingId],
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

    const [progress] = await connection.execute(
      `
      SELECT
        booking_progress.*,
        users.name AS updated_by_name
      FROM booking_progress
      JOIN users
      ON booking_progress.updated_by = users.id
      WHERE booking_progress.booking_id = ?
      ORDER BY booking_progress.created_at ASC
      `,
      [bookingId],
    );

    const formattedProgress = progress.map((item) => ({
      ...item,

      image_url: item.image
        ? `${req.protocol}://${req.get("host")}/uploads/${item.image}`
        : null,
    }));

    return res.json({
      success: true,
      data: formattedProgress,
    });
  } catch (err) {
    return handleServerError(res, err, "GET_BOOKING_PROGRESS_ERROR");
  }
};
