import connection from "../database.js";

import { handleServerError } from "../utils/errorHandler.js";


export const createTicket = async (req, res) => {
  try {
    const { vehicle_id, subject } = req.body;

    const user_id = req.user.id;

    const ticket_code = `TCK-${Date.now()}`;

    await connection.execute(
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

    return res.status(201).json({
      success: true,
      message: "Ticket berhasil dibuat",
      ticket_code,
    });
  } catch (err) {
    return handleServerError(res, err, "CREATE_TICKET_ERROR");
  }
};

export const getTickets = async (req, res) => {
  try {
    let query = `
      SELECT
        tickets.*,
        users.name AS customer_name,
        vehicles.brand,
        vehicles.model
      FROM tickets
      JOIN users
      ON tickets.user_id = users.id
      LEFT JOIN vehicles
      ON tickets.vehicle_id = vehicles.id
    `;

    let params = [];

    if (req.user.role === "customer") {
      query += `
        WHERE tickets.user_id = ?
      `;

      params.push(req.user.id);
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
    const { id } = req.params;

    const [tickets] = await connection.execute(
      `
      SELECT
        tickets.*,
        users.name AS customer_name,
        vehicles.brand,
        vehicles.model
      FROM tickets
      JOIN users
      ON tickets.user_id = users.id
      LEFT JOIN vehicles
      ON tickets.vehicle_id = vehicles.id
      WHERE tickets.id = ?
      `,
      [id],
    );

    if (tickets.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Ticket tidak ditemukan",
      });
    }

    const ticket = tickets[0];

    if (req.user.role === "customer" && ticket.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Forbidden",
      });
    }

    return res.json({
      success: true,
      data: ticket,
    });
  } catch (err) {
    return handleServerError(res, err, "GET_TICKET_BY_ID_ERROR");
  }
};

export const updateTicketStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const { status } = req.body;

    const [tickets] = await connection.execute(
      `
      SELECT *
      FROM tickets
      WHERE id = ?
      `,
      [id],
    );

    if (tickets.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Ticket tidak ditemukan",
      });
    }

    await connection.execute(
      `
      UPDATE tickets
      SET status = ?
      WHERE id = ?
      `,
      [status, id],
    );

    return res.json({
      success: true,
      message: "Status ticket berhasil diupdate",
    });
  } catch (err) {
    return handleServerError(res, err, "UPDATE_TICKET_STATUS_ERROR");
  }
};
