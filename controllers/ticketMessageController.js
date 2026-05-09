import connection from "../database.js";

import { handleServerError } from "../utils/errorHandler.js";

export const sendTicketMessage = async (req, res) => {
  try {
    const { ticket_id, message } = req.body;

    const sender_id = req.user.id;

    const attachment = req.file ? req.file.filename : null;

    const [tickets] = await connection.execute(
      `
      SELECT *
      FROM tickets
      WHERE id = ?
      `,
      [ticket_id],
    );

    if (tickets.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Ticket tidak ditemukan",
      });
    }

    await connection.execute(
      `
      INSERT INTO ticket_messages
      (
        ticket_id,
        sender_id,
        message,
        attachment
      )
      VALUES (?, ?, ?, ?)
      `,
      [ticket_id, sender_id, message, attachment],
    );

    return res.status(201).json({
      success: true,
      message: "Message berhasil dikirim",

      attachment_url: attachment
        ? `${req.protocol}://${req.get("host")}/uploads/${attachment}`
        : null,
    });
  } catch (err) {
    return handleServerError(res, err, "SEND_TICKET_MESSAGE_ERROR");
  }
};

export const getTicketMessages = async (req, res) => {
  try {
    const { ticketId } = req.params;

    const [messages] = await connection.execute(
      `
      SELECT
        ticket_messages.*,
        users.name AS sender_name,
        users.role AS sender_role
      FROM ticket_messages
      JOIN users
      ON ticket_messages.sender_id = users.id
      WHERE ticket_messages.ticket_id = ?
      ORDER BY ticket_messages.created_at ASC
      `,
      [ticketId],
    );

    const formattedMessages = messages.map((msg) => ({
      ...msg,

      attachment_url: msg.attachment
        ? `${req.protocol}://${req.get("host")}/uploads/${msg.attachment}`
        : null,
    }));

    return res.json({
      success: true,
      data: formattedMessages,
    });
  } catch (err) {
    return handleServerError(res, err, "GET_TICKET_MESSAGES_ERROR");
  }
};
