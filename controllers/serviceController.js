import connection from "../database.js";

import { handleServerError } from "../utils/errorHandler.js";

export const createService = async (req, res) => {
  try {
    const { name, description, estimated_duration, price } = req.body;

    if (!name || !description || !estimated_duration || price === undefined) {
      return res.status(400).json({
        success: false,
        message: "Semua field wajib diisi",
      });
    }

    await connection.execute(
      `
      INSERT INTO services
      (
        name,
        description,
        estimated_duration,
        price
      )
      VALUES (?, ?, ?, ?)
      `,
      [name, description, estimated_duration, price],
    );

    return res.status(201).json({
      success: true,
      message: "Service berhasil ditambahkan",
    });
  } catch (err) {
    console.error("CREATE_SERVICE_ERROR:", err);
    return handleServerError(res, err, "CREATE_SERVICE_ERROR");
  }
};

export const getAllServices = async (req, res) => {
  try {
    const [services] = await connection.execute(
      `
      SELECT
        id,
        name,
        description,
        estimated_duration,
        price,
        created_at,
        updated_at
      FROM services
      ORDER BY created_at DESC
      `,
    );

    return res.status(200).json({
      success: true,
      data: services,
    });
  } catch (err) {
    console.error("GET_ALL_SERVICES_ERROR:", err);
    return handleServerError(res, err, "GET_ALL_SERVICES_ERROR");
  }
};

export const getServiceById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "ID service wajib dikirim",
      });
    }

    const [services] = await connection.execute(
      `
      SELECT
        id,
        name,
        description,
        estimated_duration,
        price,
        created_at,
        updated_at
      FROM services
      WHERE id = ?
      LIMIT 1
      `,
      [id],
    );

    if (services.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Service tidak ditemukan",
      });
    }

    return res.status(200).json({
      success: true,
      data: services[0],
    });
  } catch (err) {
    console.error("GET_SERVICE_BY_ID_ERROR:", err);
    return handleServerError(res, err, "GET_SERVICE_BY_ID_ERROR");
  }
};

export const updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, estimated_duration, price } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "ID service wajib dikirim",
      });
    }

    if (!name || !description || !estimated_duration || price === undefined) {
      return res.status(400).json({
        success: false,
        message: "Semua field wajib diisi",
      });
    }

    const [services] = await connection.execute(
      `
      SELECT id
      FROM services
      WHERE id = ?
      LIMIT 1
      `,
      [id],
    );

    if (services.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Service tidak ditemukan",
      });
    }

    await connection.execute(
      `
      UPDATE services
      SET
        name = ?,
        description = ?,
        estimated_duration = ?,
        price = ?
      WHERE id = ?
      `,
      [name, description, estimated_duration, price, id],
    );

    return res.status(200).json({
      success: true,
      message: "Service berhasil diupdate",
    });
  } catch (err) {
    console.error("UPDATE_SERVICE_ERROR:", err);
    return handleServerError(res, err, "UPDATE_SERVICE_ERROR");
  }
};

export const deleteService = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "ID service wajib dikirim",
      });
    }

    const [services] = await connection.execute(
      `
      SELECT id
      FROM services
      WHERE id = ?
      LIMIT 1
      `,
      [id],
    );

    if (services.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Service tidak ditemukan",
      });
    }

    await connection.execute(
      `
      DELETE FROM services
      WHERE id = ?
      `,
      [id],
    );

    return res.status(200).json({
      success: true,
      message: "Service berhasil dihapus",
    });
  } catch (err) {
    console.error("DELETE_SERVICE_ERROR:", err);
    return handleServerError(res, err, "DELETE_SERVICE_ERROR");
  }
};
