import connection from "../database.js";

import { handleServerError } from "../utils/errorHandler.js";

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
