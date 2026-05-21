import connection from "../database.js";

import { handleServerError } from "../utils/errorHandler.js";

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

export const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const [users] = await connection.execute(
      `
      SELECT
        id,
        name,
        email,
        role,
        availability,
        profile_image
      FROM users
      WHERE id = ?
      `,
      [userId],
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User tidak ditemukan",
      });
    }

    const user = users[0];

    return res.json({
      success: true,

      data: {
        ...user,

        profile_image_url: user.profile_image
          ? `${req.protocol}://${req.get("host")}/uploads/${user.profile_image}`
          : null,
      },
    });
  } catch (err) {
    return handleServerError(res, err, "GET_PROFILE_ERROR");
  }
};

export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const { name, email } = req.body;

    const [users] = await connection.execute(
      `
      SELECT *
      FROM users
      WHERE id = ?
      `,
      [userId],
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User tidak ditemukan",
      });
    }

    const currentUser = users[0];

    const profile_image = req.file
      ? req.file.filename
      : currentUser.profile_image;

    await connection.execute(
      `
      UPDATE users
      SET
        name = ?,
        email = ?,
        profile_image = ?
      WHERE id = ?
      `,
      [name, email, profile_image, userId],
    );

    return res.json({
      success: true,
      message: "Profile berhasil diupdate",

      profile_image_url: profile_image
        ? `${req.protocol}://${req.get("host")}/uploads/${profile_image}`
        : null,
    });
  } catch (err) {
    return handleServerError(res, err, "UPDATE_PROFILE_ERROR");
  }
};

export const updateMechanicAvailability = async (req, res) => {
  try {
    const userId = req.user.id;
    const { availability } = req.body;

    if (req.user.role !== "mechanic") {
      return res.status(403).json({
        success: false,
        message: "Hanya mechanic yang dapat mengubah status availability",
      });
    }

    if (!["available", "off_duty"].includes(availability)) {
      return res.status(400).json({
        success: false,
        message: "Availability hanya bisa diubah ke available atau off_duty",
      });
    }

    const activeBooking = await getMechanicActiveBooking(userId);

    if (activeBooking) {
      await connection.execute(
        `
        UPDATE users
        SET availability = 'busy'
        WHERE id = ?
        `,
        [userId],
      );

      return res.status(400).json({
        success: false,
        message:
          "Tidak bisa mengubah status karena masih ada booking aktif. Selesaikan booking terlebih dahulu.",
        active_booking: activeBooking,
      });
    }

    await connection.execute(
      `
      UPDATE users
      SET availability = ?
      WHERE id = ?
      AND role = 'mechanic'
      `,
      [availability, userId],
    );

    return res.json({
      success: true,
      message: `Availability berhasil diubah ke ${availability}`,
      data: {
        availability,
      },
    });
  } catch (err) {
    return handleServerError(res, err, "UPDATE_MECHANIC_AVAILABILITY_ERROR");
  }
};
