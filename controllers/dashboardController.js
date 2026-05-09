import connection from "../database.js";

import { handleServerError } from "../utils/errorHandler.js";

export const getAdminDashboard = async (req, res) => {
  try {
    // total users
    const [[totalUsers]] = await connection.execute(
      `
      SELECT COUNT(*) AS total
      FROM users
      `,
    );

    // total mechanics
    const [[totalMechanics]] = await connection.execute(
      `
      SELECT COUNT(*) AS total
      FROM users
      WHERE role = 'mechanic'
      `,
    );

    // total bookings
    const [[totalBookings]] = await connection.execute(
      `
      SELECT COUNT(*) AS total
      FROM bookings
      `,
    );

    // completed bookings
    const [[completedBookings]] = await connection.execute(
      `
      SELECT COUNT(*) AS total
      FROM bookings
      WHERE status = 'completed'
      `,
    );

    // total tickets
    const [[totalTickets]] = await connection.execute(
      `
      SELECT COUNT(*) AS total
      FROM tickets
      `,
    );

    // total revenue
    const [[revenue]] = await connection.execute(
      `
      SELECT
        COALESCE(SUM(services.price), 0) AS total
      FROM bookings
      JOIN services
      ON bookings.service_id = services.id
      WHERE bookings.status = 'completed'
      `,
    );

    return res.json({
      success: true,
      data: {
        total_users: totalUsers.total,
        total_mechanics: totalMechanics.total,
        total_bookings: totalBookings.total,
        completed_bookings: completedBookings.total,
        total_tickets: totalTickets.total,
        total_revenue: revenue.total,
      },
    });
  } catch (err) {
    return handleServerError(
      res,
      err,
      "GET_ADMIN_DASHBOARD_ERROR",
    );
  }
};

export const getMechanicDashboard = async (req, res) => {
  try {
    const mechanicId = req.user.id;

    // assigned bookings
    const [[assignedBookings]] = await connection.execute(
      `
      SELECT COUNT(*) AS total
      FROM bookings
      WHERE mechanic_id = ?
      `,
      [mechanicId],
    );

    // completed bookings
    const [[completedBookings]] = await connection.execute(
      `
      SELECT COUNT(*) AS total
      FROM bookings
      WHERE mechanic_id = ?
      AND status = 'completed'
      `,
      [mechanicId],
    );

    // active bookings
    const [[activeBookings]] = await connection.execute(
      `
      SELECT COUNT(*) AS total
      FROM bookings
      WHERE mechanic_id = ?
      AND status IN ('accepted', 'inspection', 'in_progress')
      `,
      [mechanicId],
    );

    // total tickets
    const [[tickets]] = await connection.execute(
      `
      SELECT COUNT(*) AS total
      FROM tickets
      `,
    );

    return res.json({
      success: true,
      data: {
        assigned_bookings: assignedBookings.total,
        completed_bookings: completedBookings.total,
        active_bookings: activeBookings.total,
        total_tickets: tickets.total,
      },
    });
  } catch (err) {
    return handleServerError(
      res,
      err,
      "GET_MECHANIC_DASHBOARD_ERROR",
    );
  }
};

export const getCustomerDashboard = async (req, res) => {
  try {
    const userId = req.user.id;

    // total vehicles
    const [[vehicles]] = await connection.execute(
      `
      SELECT COUNT(*) AS total
      FROM vehicles
      WHERE user_id = ?
      `,
      [userId],
    );

    // total bookings
    const [[bookings]] = await connection.execute(
      `
      SELECT COUNT(*) AS total
      FROM bookings
      WHERE user_id = ?
      `,
      [userId],
    );

    // active bookings
    const [[activeBookings]] = await connection.execute(
      `
      SELECT COUNT(*) AS total
      FROM bookings
      WHERE user_id = ?
      AND status IN ('pending', 'accepted', 'inspection', 'in_progress')
      `,
      [userId],
    );

    // completed bookings
    const [[completedBookings]] = await connection.execute(
      `
      SELECT COUNT(*) AS total
      FROM bookings
      WHERE user_id = ?
      AND status = 'completed'
      `,
      [userId],
    );

    return res.json({
      success: true,
      data: {
        total_vehicles: vehicles.total,
        total_bookings: bookings.total,
        active_bookings: activeBookings.total,
        completed_bookings: completedBookings.total,
      },
    });
  } catch (err) {
    return handleServerError(
      res,
      err,
      "GET_CUSTOMER_DASHBOARD_ERROR",
    );
  }
};