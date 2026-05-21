import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import connection from "../database.js";

import { handleServerError } from "../utils/errorHandler.js";

import { isValidEmail, isNotEmpty } from "../utils/validation.js";

const JWT_SECRET = process.env.JWT_SECRET;

const activeBookingStatusList = ["accepted", "inspection", "in_progress"];

const getMechanicActiveBooking = async (mechanicId) => {
  const [bookings] = await connection.execute(
    `
    SELECT id
    FROM bookings
    WHERE mechanic_id = ?
    AND status IN ('accepted', 'inspection', 'in_progress')
    LIMIT 1
    `,
    [mechanicId],
  );

  return bookings[0] || null;
};

const syncMechanicAvailabilityOnLogin = async (user) => {
  if (user.role !== "mechanic") {
    return user.availability;
  }

  const activeBooking = await getMechanicActiveBooking(user.id);

  if (activeBooking) {
    await connection.execute(
      `
      UPDATE users
      SET availability = 'busy'
      WHERE id = ?
      `,
      [user.id],
    );

    return "busy";
  }

  if (user.availability === "off_duty") {
    return "off_duty";
  }

  await connection.execute(
    `
    UPDATE users
    SET availability = 'available'
    WHERE id = ?
    `,
    [user.id],
  );

  return "available";
};

// REGISTER
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!isNotEmpty(name) || !isNotEmpty(email) || !isNotEmpty(password)) {
      return res.status(400).json({
        success: false,
        message: "Semua field wajib diisi",
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Format email tidak valid",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password minimal 6 karakter",
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const [existingUsers] = await connection.execute(
      `
      SELECT id
      FROM users
      WHERE LOWER(TRIM(email)) = ?
      `,
      [normalizedEmail],
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Email sudah digunakan",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await connection.execute(
      `
      INSERT INTO users
      (name, email, password, role)
      VALUES (?, ?, ?, ?)
      `,
      [name, normalizedEmail, hashedPassword, "customer"],
    );

    return res.status(201).json({
      success: true,
      message: "Register berhasil",
    });
  } catch (err) {
    return handleServerError(res, err, "REGISTER_ERROR");
  }
};

// LOGIN
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!isNotEmpty(email) || !isNotEmpty(password)) {
      return res.status(400).json({
        success: false,
        message: "Email dan password wajib diisi",
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const [users] = await connection.execute(
      `
      SELECT *
      FROM users
      WHERE LOWER(TRIM(email)) = ?
      LIMIT 1
      `,
      [normalizedEmail],
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Email tidak ditemukan",
      });
    }

    const user = users[0];

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Password salah",
      });
    }

    const availability = await syncMechanicAvailabilityOnLogin(user);

    const token = jwt.sign(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      JWT_SECRET,
      {
        expiresIn: "1d",
      },
    );

    return res.json({
      success: true,
      message: "Login berhasil",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        availability,
      },
    });
  } catch (error) {
    console.error("LOGIN_ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Server error login",
      error: error.message,
    });
  }
};

// ME
export const me = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const userId = req.user.id;

    const [users] = await connection.execute(
      `
      SELECT
        id,
        name,
        email,
        role,
        availability
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

    return res.json({
      success: true,
      user: users[0],
    });
  } catch (err) {
    return handleServerError(res, err, "ME_ERROR");
  }
};

// LOGOUT
export const logout = async (req, res) => {
  try {
    if (req.user.role === "mechanic") {
      const activeBooking = await getMechanicActiveBooking(req.user.id);

      if (!activeBooking) {
        await connection.execute(
          `
          UPDATE users
          SET availability = 'off_duty'
          WHERE id = ?
          AND role = 'mechanic'
          `,
          [req.user.id],
        );
      }
    }

    return res.json({
      success: true,
      message: "Logout berhasil",
    });
  } catch (err) {
    return handleServerError(res, err, "LOGOUT_ERROR");
  }
};
