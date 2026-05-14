import connection from "../database.js";

import { handleServerError } from "../utils/errorHandler.js";

export const getMyNotifications = async (req, res) => {
  try {
    const user_id = req.user.id;

    const [notifications] = await connection.execute(
      `
      SELECT *
      FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 50
      `,
      [user_id],
    );

    return res.json({
      success: true,
      data: notifications,
    });
  } catch (err) {
    return handleServerError(res, err, "GET_MY_NOTIFICATIONS_ERROR");
  }
};

export const getUnreadNotificationCount = async (req, res) => {
  try {
    const user_id = req.user.id;

    const [rows] = await connection.execute(
      `
      SELECT COUNT(*) AS unread_count
      FROM notifications
      WHERE user_id = ?
      AND is_read = FALSE
      `,
      [user_id],
    );

    return res.json({
      success: true,
      data: {
        unread_count: rows[0].unread_count || 0,
      },
    });
  } catch (err) {
    return handleServerError(res, err, "GET_UNREAD_NOTIFICATION_COUNT_ERROR");
  }
};

export const markNotificationAsRead = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { id } = req.params;

    const [notifications] = await connection.execute(
      `
      SELECT id
      FROM notifications
      WHERE id = ?
      AND user_id = ?
      `,
      [id, user_id],
    );

    if (notifications.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Notification tidak ditemukan",
      });
    }

    await connection.execute(
      `
      UPDATE notifications
      SET is_read = TRUE
      WHERE id = ?
      AND user_id = ?
      `,
      [id, user_id],
    );

    return res.json({
      success: true,
      message: "Notification berhasil dibaca",
    });
  } catch (err) {
    return handleServerError(res, err, "MARK_NOTIFICATION_AS_READ_ERROR");
  }
};

export const markAllNotificationsAsRead = async (req, res) => {
  try {
    const user_id = req.user.id;

    await connection.execute(
      `
      UPDATE notifications
      SET is_read = TRUE
      WHERE user_id = ?
      `,
      [user_id],
    );

    return res.json({
      success: true,
      message: "Semua notification berhasil dibaca",
    });
  } catch (err) {
    return handleServerError(res, err, "MARK_ALL_NOTIFICATIONS_AS_READ_ERROR");
  }
};

export const deleteNotification = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { id } = req.params;

    const [notifications] = await connection.execute(
      `
      SELECT id
      FROM notifications
      WHERE id = ?
      AND user_id = ?
      `,
      [id, user_id],
    );

    if (notifications.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Notification tidak ditemukan",
      });
    }

    await connection.execute(
      `
      DELETE FROM notifications
      WHERE id = ?
      AND user_id = ?
      `,
      [id, user_id],
    );

    return res.json({
      success: true,
      message: "Notification berhasil dihapus",
    });
  } catch (err) {
    return handleServerError(res, err, "DELETE_NOTIFICATION_ERROR");
  }
};
