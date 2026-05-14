import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import connection from "../database.js";

import { handleServerError } from "../utils/errorHandler.js";

import { isValidEmail, isNotEmpty } from "../utils/validation.js";

const JWT_SECRET = process.env.JWT_SECRET;

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

    const [existingUsers] = await connection.execute(
      `
      SELECT id
      FROM users
      WHERE email = ?
      `,
      [email],
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
      [name, email, hashedPassword, "customer"],
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
        role
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
