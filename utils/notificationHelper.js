import connection from "../database.js";

export const createNotification = async ({
  user_id,
  title,
  message,
  type = "system",
  reference_id = null,
  reference_url = null,
}) => {
  if (!user_id || !title || !message) {
    return null;
  }

  const [result] = await connection.execute(
    `
    INSERT INTO notifications
    (
      user_id,
      title,
      message,
      type,
      reference_id,
      reference_url
    )
    VALUES (?, ?, ?, ?, ?, ?)
    `,
    [user_id, title, message, type, reference_id, reference_url],
  );

  return result.insertId;
};

export const createBulkNotifications = async (notifications = []) => {
  if (!Array.isArray(notifications) || notifications.length === 0) {
    return;
  }

  for (const notification of notifications) {
    await createNotification(notification);
  }
};
