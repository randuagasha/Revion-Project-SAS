import bcrypt from "bcryptjs";

import connection from "../database.js";

import { handleServerError } from "../utils/errorHandler.js";

export const createUser = async (req, res) => {
  try {
    const { name, email, password, role, availability } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: "Name, email, password, dan role wajib diisi",
      });
    }

    const allowedRoles = ["customer", "mechanic", "super_admin"];

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Role tidak valid",
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

    const userAvailability =
      role === "mechanic" ? availability || "available" : null;

    await connection.execute(
      `
      INSERT INTO users
      (
        name,
        email,
        password,
        role,
        availability
      )
      VALUES (?, ?, ?, ?, ?)
      `,
      [name, email, hashedPassword, role, userAvailability],
    );

    return res.status(201).json({
      success: true,
      message: "User berhasil dibuat",
    });
  } catch (err) {
    console.error("CREATE_ADMIN_USER_ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Gagal membuat user",
      error: err.message,
    });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const { role, search } = req.query;

    let query = `
      SELECT
        id,
        name,
        email,
        role,
        availability,
        created_at,
        updated_at
      FROM users
      WHERE 1=1
    `;

    const values = [];

    if (role) {
      query += ` AND role = ? `;
      values.push(role);
    }

    if (search) {
      query += `
        AND (
          name LIKE ?
          OR email LIKE ?
          OR role LIKE ?
          OR availability LIKE ?
        )
      `;

      const keyword = `%${search}%`;

      values.push(keyword, keyword, keyword, keyword);
    }

    query += ` ORDER BY created_at DESC `;

    const [users] = await connection.execute(query, values);

    return res.json({
      success: true,
      total: users.length,
      data: users,
    });
  } catch (err) {
    console.error("GET_ALL_USERS_ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Gagal mengambil data user",
      error: err.message,
    });
  }
};

export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const [users] = await connection.execute(
      `
      SELECT
        id,
        name,
        email,
        phone,
        role,
        created_at
      FROM users
      WHERE id = ?
      `,
      [id],
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User tidak ditemukan",
      });
    }

    return res.json({
      success: true,
      data: users[0],
    });
  } catch (err) {
    return handleServerError(res, err, "GET_USER_BY_ID_ERROR");
  }
};

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;

    const { name, email, phone, role } = req.body;

    const [users] = await connection.execute(
      `
      SELECT *
      FROM users
      WHERE id = ?
      `,
      [id],
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User tidak ditemukan",
      });
    }

    await connection.execute(
      `
      UPDATE users
      SET
        name = ?,
        email = ?,
        phone = ?,
        role = ?
      WHERE id = ?
      `,
      [name, email, phone, role, id],
    );

    return res.json({
      success: true,
      message: "User berhasil diupdate",
    });
  } catch (err) {
    return handleServerError(res, err, "UPDATE_USER_ERROR");
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const [users] = await connection.execute(
      `
      SELECT *
      FROM users
      WHERE id = ?
      `,
      [id],
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User tidak ditemukan",
      });
    }

    await connection.execute(
      `
      DELETE FROM users
      WHERE id = ?
      `,
      [id],
    );

    return res.json({
      success: true,
      message: "User berhasil dihapus",
    });
  } catch (err) {
    return handleServerError(res, err, "DELETE_USER_ERROR");
  }
};
