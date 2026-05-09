import connection from "../database.js";

import { handleServerError } from "../utils/errorHandler.js";

import { isNotEmpty, isInEnum } from "../utils/validation.js";

// CREATE BOOKING PROGRESS
export const createBookingProgress = async (req, res) => {
  try {
    const { booking_id, status, notes } = req.body;

    const updated_by = req.user.id;

    // VALIDATION
    if (!isNotEmpty(booking_id) || !isNotEmpty(status) || !isNotEmpty(notes)) {
      return res.status(400).json({
        success: false,
        message: "Semua field wajib diisi",
      });
    }

    if (
      !isInEnum(status, [
        "accepted",
        "inspection",
        "in_progress",
        "completed",
        "cancelled",
      ])
    ) {
      return res.status(400).json({
        success: false,
        message: "Status booking tidak valid",
      });
    }

    // CHECK BOOKING
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

    // ACCESS VALIDATION
    if (req.user.role === "mechanic" && booking.mechanic_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Anda tidak memiliki akses ke booking ini",
      });
    }

    // INSERT PROGRESS
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

    // SAVE PROGRESS IMAGES
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

    // UPDATE BOOKING STATUS
    await connection.execute(
      `
      UPDATE bookings
      SET
        status = ?,
        updated_at = NOW()
      WHERE id = ?
      `,
      [status, booking_id],
    );

    // UPDATE MECHANIC AVAILABILITY
    if (status === "completed") {
      const [activeBookings] = await connection.execute(
        `
        SELECT id
        FROM bookings
        WHERE mechanic_id = ?
        AND status IN (
          'accepted',
          'inspection',
          'in_progress'
        )
        `,
        [booking.mechanic_id],
      );

      if (activeBookings.length === 0) {
        await connection.execute(
          `
          UPDATE users
          SET availability = 'available'
          WHERE id = ?
          `,
          [booking.mechanic_id],
        );
      }
    }

    return res.status(201).json({
      success: true,
      message: "Progress booking berhasil ditambahkan",

      data: {
        progress_id,
        booking_id,
        status,
      },
    });
  } catch (err) {
    return handleServerError(res, err, "CREATE_BOOKING_PROGRESS_ERROR");
  }
};

// GET BOOKING PROGRESS BY BOOKING ID
export const getBookingProgressByBookingId = async (req, res) => {
  try {
    const { bookingId } = req.params;

    // CHECK BOOKING
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

    // ACCESS VALIDATION
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

    // GET PROGRESS
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
      total_progress: formattedProgress.length,
      data: formattedProgress,
    });
  } catch (err) {
    return handleServerError(res, err, "GET_BOOKING_PROGRESS_ERROR");
  }
};
