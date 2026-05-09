import connection from "../database.js";

import { handleServerError } from "../utils/errorHandler.js";

export const createBookingProgress = async (req, res) => {
  try {
    const { booking_id, status, notes } = req.body;

    const updated_by = req.user.id;

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

    const booking = bookings[0];

    if (req.user.role === "mechanic" && booking.mechanic_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Anda tidak memiliki akses ke booking ini",
      });
    }

    const [result] = await connection.execute(
      `
      INSERT INTO booking_progress
      (
        booking_id,
        status,
        notes,
        updated_by
      )
      VALUES (?, ?, ?, ?)
      `,
      [booking_id, status, notes, updated_by],
    );

    const progress_id = result.insertId;

    // =========================
    // SAVE MULTIPLE IMAGES
    // =========================
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        await connection.execute(
          `
          INSERT INTO booking_images
          (
            booking_id,
            progress_id,
            image
          )
          VALUES (?, ?, ?)
          `,
          [booking_id, progress_id, file.filename],
        );
      }
    }

    // =========================
    // UPDATE BOOKING STATUS
    // =========================
    await connection.execute(
      `
      UPDATE bookings
      SET status = ?
      WHERE id = ?
      `,
      [status, booking_id],
    );

    if (status === "completed") {
      await connection.execute(
        `
        UPDATE users
        SET availability = 'available'
        WHERE id = ?
        `,
        [booking.mechanic_id],
      );
    }

    return res.status(201).json({
      success: true,
      message: "Progress booking berhasil ditambahkan",
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

    if (req.user.role === "mechanic" && booking.mechanic_id !== req.user.id) {
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

    const formattedProgress = [];

    for (const item of progress) {
      const [images] = await connection.execute(
        `
        SELECT *
        FROM booking_images
        WHERE progress_id = ?
        `,
        [item.id],
      );

      const formattedImages = images.map((img) => ({
        id: img.id,
        image: img.image,

        image_url: `${req.protocol}://${req.get("host")}/uploads/${img.image}`,
      }));

      formattedProgress.push({
        ...item,
        images: formattedImages,
      });
    }

    return res.json({
      success: true,
      data: formattedProgress,
    });
  } catch (err) {
    return handleServerError(res, err, "GET_BOOKING_PROGRESS_ERROR");
  }
};
