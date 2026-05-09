import connection from "../database.js";

import { handleServerError } from "../utils/errorHandler.js";

// ADMIN DASHBOARD
export const getAdminDashboard = async (req, res) => {
  try {
    // TOTAL USERS
    const [[totalUsers]] = await connection.execute(
      `
      SELECT COUNT(*) AS total
      FROM users
      `,
    );

    // TOTAL MECHANICS
    const [[totalMechanics]] = await connection.execute(
      `
      SELECT COUNT(*) AS total
      FROM users
      WHERE role = 'mechanic'
      `,
    );

    // TOTAL BOOKINGS
    const [[totalBookings]] = await connection.execute(
      `
      SELECT COUNT(*) AS total
      FROM bookings
      `,
    );

    // =========================
    // COMPLETED BOOKINGS
    // =========================
    const [[completedBookings]] = await connection.execute(
      `
      SELECT COUNT(*) AS total
      FROM bookings
      WHERE status = 'completed'
      `,
    );

    // ACTIVE BOOKINGS
    const [[activeBookings]] = await connection.execute(
      `
      SELECT COUNT(*) AS total
      FROM bookings
      WHERE status IN (
        'accepted',
        'inspection',
        'in_progress'
      )
      `,
    );

    // TOTAL TICKETS
    const [[totalTickets]] = await connection.execute(
      `
      SELECT COUNT(*) AS total
      FROM tickets
      `,
    );

    // TOTAL REVENUE
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

    // AVAILABLE MECHANICS
    const [[availableMechanics]] = await connection.execute(
      `
      SELECT COUNT(*) AS total
      FROM users
      WHERE role = 'mechanic'
      AND availability = 'available'
      `,
    );

    // BUSY MECHANICS
    const [[busyMechanics]] = await connection.execute(
      `
      SELECT COUNT(*) AS total
      FROM users
      WHERE role = 'mechanic'
      AND availability = 'busy'
      `,
    );

    // MONTHLY BOOKINGS
    const [monthlyBookings] = await connection.execute(
      `
      SELECT
        MONTH(created_at) AS month,
        COUNT(*) AS total
      FROM bookings

      GROUP BY MONTH(created_at)

      ORDER BY month ASC
      `,
    );

    // RECENT BOOKINGS
    const [recentBookings] = await connection.execute(
      `
      SELECT
        bookings.id,
        bookings.booking_code,
        bookings.status,
        bookings.created_at,

        users.name AS customer_name,

        vehicles.brand,
        vehicles.model,

        services.name AS service_name,

        mechanics.name AS mechanic_name

      FROM bookings

      JOIN users
        ON bookings.user_id = users.id

      JOIN vehicles
        ON bookings.vehicle_id = vehicles.id

      JOIN services
        ON bookings.service_id = services.id

      LEFT JOIN users AS mechanics
        ON bookings.mechanic_id = mechanics.id

      ORDER BY bookings.created_at DESC

      LIMIT 5
      `,
    );

    // MECHANIC PERFORMANCE
    const [mechanicPerformance] = await connection.execute(
      `
      SELECT
        users.id,
        users.name,

        COUNT(bookings.id) AS total_jobs

      FROM users

      LEFT JOIN bookings
        ON users.id = bookings.mechanic_id

      WHERE users.role = 'mechanic'

      GROUP BY users.id

      ORDER BY total_jobs DESC
      `,
    );

    return res.json({
      success: true,

      data: {
        statistics: {
          total_users: totalUsers.total,

          total_mechanics: totalMechanics.total,

          total_bookings: totalBookings.total,

          active_bookings: activeBookings.total,

          completed_bookings: completedBookings.total,

          total_tickets: totalTickets.total,

          total_revenue: revenue.total,

          available_mechanics: availableMechanics.total,

          busy_mechanics: busyMechanics.total,
        },

        charts: {
          monthly_bookings: monthlyBookings,
        },

        recent_bookings: recentBookings,

        mechanic_performance: mechanicPerformance,
      },
    });
  } catch (err) {
    return handleServerError(res, err, "GET_ADMIN_DASHBOARD_ERROR");
  }
};

// MECHANIC DASHBOARD
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
      AND status IN (
        'accepted',
        'inspection',
        'in_progress'
      )
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

    // recent assigned bookings
    const [recentBookings] = await connection.execute(
      `
      SELECT
        bookings.id,
        bookings.booking_code,
        bookings.status,
        bookings.created_at,

        users.name AS customer_name,

        vehicles.brand,
        vehicles.model,

        services.name AS service_name

      FROM bookings

      JOIN users
        ON bookings.user_id = users.id

      JOIN vehicles
        ON bookings.vehicle_id = vehicles.id

      JOIN services
        ON bookings.service_id = services.id

      WHERE bookings.mechanic_id = ?

      ORDER BY bookings.created_at DESC

      LIMIT 5
      `,
      [mechanicId],
    );

    return res.json({
      success: true,

      data: {
        statistics: {
          assigned_bookings: assignedBookings.total,

          completed_bookings: completedBookings.total,

          active_bookings: activeBookings.total,

          total_tickets: tickets.total,
        },

        recent_bookings: recentBookings,
      },
    });
  } catch (err) {
    return handleServerError(res, err, "GET_MECHANIC_DASHBOARD_ERROR");
  }
};

// =========================
// CUSTOMER DASHBOARD
// =========================
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
      AND status IN (
        'pending',
        'accepted',
        'inspection',
        'in_progress'
      )
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

    // recent bookings
    const [recentBookings] = await connection.execute(
      `
      SELECT
        bookings.id,
        bookings.booking_code,
        bookings.status,
        bookings.created_at,

        vehicles.brand,
        vehicles.model,

        services.name AS service_name,

        mechanics.name AS mechanic_name

      FROM bookings

      JOIN vehicles
        ON bookings.vehicle_id = vehicles.id

      JOIN services
        ON bookings.service_id = services.id

      LEFT JOIN users AS mechanics
        ON bookings.mechanic_id = mechanics.id

      WHERE bookings.user_id = ?

      ORDER BY bookings.created_at DESC

      LIMIT 5
      `,
      [userId],
    );

    return res.json({
      success: true,

      data: {
        statistics: {
          total_vehicles: vehicles.total,

          total_bookings: bookings.total,

          active_bookings: activeBookings.total,

          completed_bookings: completedBookings.total,
        },

        recent_bookings: recentBookings,
      },
    });
  } catch (err) {
    return handleServerError(res, err, "GET_CUSTOMER_DASHBOARD_ERROR");
  }
};
