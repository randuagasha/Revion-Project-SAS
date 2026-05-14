import connection from "../database.js";

import { handleServerError } from "../utils/errorHandler.js";

import {
  createNotification,
  createBulkNotifications,
} from "../utils/notificationHelper.js";

const ticketStatusList = ["open", "in_review", "resolved", "closed"];

const formatStatusText = (status) => {
  return String(status || "").replace("_", " ");
};

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
    SELECT
      tickets.*,
      customers.name AS customer_name,
      vehicles.brand,
      vehicles.model
    FROM tickets
    JOIN users AS customers
      ON tickets.user_id = customers.id
    LEFT JOIN vehicles
      ON tickets.vehicle_id = vehicles.id
    WHERE tickets.id = ?
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

export const createTicket = async (req, res) => {
  try {
    const { vehicle_id, subject } = req.body;

    const user_id = req.user.id;

    if (!subject) {
      return res.status(400).json({
        success: false,
        message: "Subject wajib diisi",
      });
    }

    const ticket_code = `TCK-${Date.now()}`;

    const [result] = await connection.execute(
      `
      INSERT INTO tickets
      (
        ticket_code,
        user_id,
        vehicle_id,
        subject
      )
      VALUES (?, ?, ?, ?)
      `,
      [ticket_code, user_id, vehicle_id || null, subject],
    );

    const ticket_id = result.insertId;

    const superAdmins = await getSuperAdmins();

    await createBulkNotifications(
      superAdmins.map((admin) => ({
        user_id: admin.id,
        title: "New Customer Ticket",
        message: `New ticket ${ticket_code} has been created: ${subject}.`,
        type: "ticket",
        reference_id: ticket_id,
        reference_url: `/super_admin/tickets/${ticket_id}`,
      })),
    );

    if (vehicle_id) {
      const mechanics = await getRelatedMechanicsByVehicleId(vehicle_id);

      await createBulkNotifications(
        mechanics.map((mechanic) => ({
          user_id: mechanic.id,
          title: "New Related Ticket",
          message: `A customer created a ticket related to a vehicle you handled: ${subject}.`,
          type: "ticket",
          reference_id: ticket_id,
          reference_url: `/mechanics/tickets/${ticket_id}`,
        })),
      );
    }

    return res.status(201).json({
      success: true,
      message: "Ticket berhasil dibuat",
      data: {
        ticket_id,
        ticket_code,
      },
    });
  } catch (err) {
    return handleServerError(res, err, "CREATE_TICKET_ERROR");
  }
};

export const getTickets = async (req, res) => {
  try {
    const params = [];

    let query = `
      SELECT DISTINCT
        tickets.*,
        customers.name AS customer_name,
        vehicles.brand,
        vehicles.model
      FROM tickets
      JOIN users AS customers
        ON tickets.user_id = customers.id
      LEFT JOIN vehicles
        ON tickets.vehicle_id = vehicles.id
    `;

    if (req.user.role === "mechanic") {
      query += `
        JOIN bookings
          ON bookings.vehicle_id = tickets.vehicle_id
          AND bookings.mechanic_id = ?
      `;

      params.push(Number(req.user.id));
    }

    const whereConditions = [];

    if (req.user.role === "customer") {
      whereConditions.push(`tickets.user_id = ?`);
      params.push(Number(req.user.id));
    }

    if (whereConditions.length > 0) {
      query += `
        WHERE ${whereConditions.join(" AND ")}
      `;
    }

    query += `
      ORDER BY tickets.created_at DESC
    `;

    const [tickets] = await connection.execute(query, params);

    return res.json({
      success: true,
      data: tickets,
    });
  } catch (err) {
    return handleServerError(res, err, "GET_TICKETS_ERROR");
  }
};

export const getTicketById = async (req, res) => {
  try {
    const access = await checkTicketAccess(req.params.id, req.user);

    if (!access.allowed) {
      return res.status(access.status).json({
        success: false,
        message: access.message,
      });
    }

    return res.json({
      success: true,
      data: access.ticket,
    });
  } catch (err) {
    return handleServerError(res, err, "GET_TICKET_BY_ID_ERROR");
  }
};

export const updateTicketStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!ticketStatusList.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status ticket tidak valid",
      });
    }

    const access = await checkTicketAccess(id, req.user);

    if (!access.allowed) {
      return res.status(access.status).json({
        success: false,
        message: access.message,
      });
    }

    if (!["mechanic", "super_admin"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Hanya mechanic atau super admin yang dapat update status",
      });
    }

    const ticket = access.ticket;

    await connection.execute(
      `
      UPDATE tickets
      SET status = ?
      WHERE id = ?
      `,
      [status, Number(id)],
    );

    const statusText = formatStatusText(status);

    await createNotification({
      user_id: ticket.user_id,
      title: "Ticket Status Updated",
      message: `Your ticket ${ticket.ticket_code} status has been updated to ${statusText}.`,
      type: "ticket",
      reference_id: ticket.id,
      reference_url: `/customers/tickets/${ticket.id}`,
    });

    if (req.user.role === "mechanic") {
      const superAdmins = await getSuperAdmins();

      await createBulkNotifications(
        superAdmins.map((admin) => ({
          user_id: admin.id,
          title: "Ticket Status Updated",
          message: `Ticket ${ticket.ticket_code} status has been updated to ${statusText} by mechanic.`,
          type: "ticket",
          reference_id: ticket.id,
          reference_url: `/super_admin/tickets/${ticket.id}`,
        })),
      );
    }

    if (req.user.role === "super_admin" && ticket.vehicle_id) {
      const mechanics = await getRelatedMechanicsByVehicleId(ticket.vehicle_id);

      await createBulkNotifications(
        mechanics.map((mechanic) => ({
          user_id: mechanic.id,
          title: "Ticket Status Updated",
          message: `Ticket ${ticket.ticket_code} status has been updated to ${statusText}.`,
          type: "ticket",
          reference_id: ticket.id,
          reference_url: `/mechanics/tickets/${ticket.id}`,
        })),
      );
    }

    return res.json({
      success: true,
      message: "Status ticket berhasil diupdate",
    });
  } catch (err) {
    return handleServerError(res, err, "UPDATE_TICKET_STATUS_ERROR");
  }
};
