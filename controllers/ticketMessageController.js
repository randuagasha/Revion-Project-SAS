import connection from "../database.js";

import { handleServerError } from "../utils/errorHandler.js";

import {
  createNotification,
  createBulkNotifications,
} from "../utils/notificationHelper.js";

const getSuperAdmins = async () => {
  const [superAdmins] = await connection.execute(
    `
    SELECT id
    FROM users
    WHERE role = 'super_admin'
    `,
  );

  return superAdmins;
};

const getRelatedMechanicsByVehicleId = async (vehicleId) => {
  if (!vehicleId) return [];

  const [mechanics] = await connection.execute(
    `
    SELECT DISTINCT
      users.id,
      users.name
    FROM bookings
    JOIN users
      ON bookings.mechanic_id = users.id
    WHERE bookings.vehicle_id = ?
      AND bookings.mechanic_id IS NOT NULL
      AND users.role = 'mechanic'
    `,
    [Number(vehicleId)],
  );

  return mechanics;
};

const checkTicketAccess = async (ticketId, user) => {
  const [tickets] = await connection.execute(
    `
    SELECT *
    FROM tickets
    WHERE id = ?
    `,
    [Number(ticketId)],
  );

  if (tickets.length === 0) {
    return {
      allowed: false,
      status: 404,
      message: "Ticket tidak ditemukan",
      ticket: null,
    };
  }

  const ticket = tickets[0];

  if (user.role === "super_admin") {
    return {
      allowed: true,
      ticket,
    };
  }

  if (user.role === "customer") {
    if (Number(ticket.user_id) !== Number(user.id)) {
      return {
        allowed: false,
        status: 403,
        message: "Forbidden",
        ticket: null,
      };
    }

    return {
      allowed: true,
      ticket,
    };
  }

  if (user.role === "mechanic") {
    if (!ticket.vehicle_id) {
      return {
        allowed: false,
        status: 403,
        message: "Ticket tidak terkait vehicle yang ditangani mechanic",
        ticket: null,
      };
    }

    const [relatedBookings] = await connection.execute(
      `
      SELECT id
      FROM bookings
      WHERE mechanic_id = ?
        AND vehicle_id = ?
      LIMIT 1
      `,
      [Number(user.id), Number(ticket.vehicle_id)],
    );

    if (relatedBookings.length === 0) {
      return {
        allowed: false,
        status: 403,
        message: "Mechanic tidak memiliki akses ke ticket ini",
        ticket: null,
      };
    }

    return {
      allowed: true,
      ticket,
    };
  }

  return {
    allowed: false,
    status: 403,
    message: "Role tidak diizinkan",
    ticket: null,
  };
};

export const sendTicketMessage = async (req, res) => {
  try {
    const { ticket_id, message } = req.body;

    const sender_id = req.user.id;

    const attachment = req.file ? req.file.filename : null;

    if (!ticket_id) {
      return res.status(400).json({
        success: false,
        message: "Ticket ID wajib diisi",
      });
    }

    if (!message && !attachment) {
      return res.status(400).json({
        success: false,
        message: "Message atau attachment wajib diisi",
      });
    }

    const access = await checkTicketAccess(ticket_id, req.user);

    if (!access.allowed) {
      return res.status(access.status).json({
        success: false,
        message: access.message,
      });
    }

    const ticket = access.ticket;

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
      [Number(ticket_id), sender_id, message || "", attachment],
    );

    const messagePreview = message
      ? message.length > 80
        ? `${message.slice(0, 80)}...`
        : message
      : "Attachment sent";

    if (req.user.role === "customer") {
      const superAdmins = await getSuperAdmins();

      await createBulkNotifications(
        superAdmins.map((admin) => ({
          user_id: admin.id,
          title: "New Customer Ticket Reply",
          message: `Customer replied to ticket ${ticket.ticket_code}: ${messagePreview}`,
          type: "ticket_message",
          reference_id: ticket.id,
          reference_url: `/super_admin/tickets/${ticket.id}`,
        })),
      );

      if (ticket.vehicle_id) {
        const mechanics = await getRelatedMechanicsByVehicleId(
          ticket.vehicle_id,
        );

        await createBulkNotifications(
          mechanics.map((mechanic) => ({
            user_id: mechanic.id,
            title: "New Customer Ticket Reply",
            message: `Customer replied to a related ticket ${ticket.ticket_code}.`,
            type: "ticket_message",
            reference_id: ticket.id,
            reference_url: `/mechanics/tickets/${ticket.id}`,
          })),
        );
      }
    }

    if (req.user.role === "mechanic") {
      await createNotification({
        user_id: ticket.user_id,
        title: "Mechanic Replied to Your Ticket",
        message: `Mechanic replied to your ticket ${ticket.ticket_code}: ${messagePreview}`,
        type: "ticket_message",
        reference_id: ticket.id,
        reference_url: `/customers/tickets/${ticket.id}`,
      });

      const superAdmins = await getSuperAdmins();

      await createBulkNotifications(
        superAdmins.map((admin) => ({
          user_id: admin.id,
          title: "Mechanic Ticket Reply",
          message: `Mechanic replied to ticket ${ticket.ticket_code}.`,
          type: "ticket_message",
          reference_id: ticket.id,
          reference_url: `/super_admin/tickets/${ticket.id}`,
        })),
      );
    }

    if (req.user.role === "super_admin") {
      await createNotification({
        user_id: ticket.user_id,
        title: "Admin Replied to Your Ticket",
        message: `Admin replied to your ticket ${ticket.ticket_code}: ${messagePreview}`,
        type: "ticket_message",
        reference_id: ticket.id,
        reference_url: `/customers/tickets/${ticket.id}`,
      });

      if (ticket.vehicle_id) {
        const mechanics = await getRelatedMechanicsByVehicleId(
          ticket.vehicle_id,
        );

        await createBulkNotifications(
          mechanics.map((mechanic) => ({
            user_id: mechanic.id,
            title: "Admin Ticket Reply",
            message: `Admin replied to related ticket ${ticket.ticket_code}.`,
            type: "ticket_message",
            reference_id: ticket.id,
            reference_url: `/mechanics/tickets/${ticket.id}`,
          })),
        );
      }
    }

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

    const access = await checkTicketAccess(ticketId, req.user);

    if (!access.allowed) {
      return res.status(access.status).json({
        success: false,
        message: access.message,
      });
    }

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
      [Number(ticketId)],
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