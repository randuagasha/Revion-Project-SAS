import bcrypt from "bcryptjs";

import connection from "../database.js";

import { handleServerError } from "../utils/errorHandler.js";

export const createUser = async (req, res) => {
  try {
    const { name, email, password, phone, role } = req.body;

    const [existing] = await connection.execute(
      `
      SELECT *
      FROM users
      WHERE email = ?
      `,
      [email],
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Email sudah digunakan",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await connection.execute(
      `
      INSERT INTO users
      (
        name,
        email,
        password,
        phone,
        role
      )
      VALUES (?, ?, ?, ?, ?)
      `,
      [name, email, hashedPassword, phone, role],
    );

    return res.status(201).json({
      success: true,
      message: "User berhasil dibuat",
    });
  } catch (err) {
    return handleServerError(res, err, "CREATE_USER_ERROR");
  }
};

export const getAllUsers = async (req, res) => {
  try {
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
      ORDER BY created_at DESC
      `,
    );

    return res.json({
      success: true,
      data: users,
    });
  } catch (err) {
    return handleServerError(res, err, "GET_ALL_USERS_ERROR");
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
