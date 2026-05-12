import connection from "../database.js";

import { handleServerError } from "../utils/errorHandler.js";
import { isNotEmpty, isValidYear, isInEnum } from "../utils/validation.js";

export const createVehicle = async (req, res) => {
  try {
    const { brand, model, year, license_plate } = req.body;

    const user_id = req.user.id;

    const image = req.file ? `/uploads/${req.file.filename}` : null;

    if (!brand || !model || !year || !license_plate) {
      return res.status(400).json({
        success: false,
        message: "Brand, model, year, dan license plate wajib diisi",
      });
    }

    const [result] = await connection.execute(
      `
      INSERT INTO vehicles 
      (user_id, brand, model, year, license_plate, image)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [user_id, brand, model, year, license_plate, image],
    );

    return res.status(201).json({
      success: true,
      message: "Vehicle berhasil dibuat",
      data: {
        id: result.insertId,
        user_id,
        brand,
        model,
        year,
        license_plate,
        image,
      },
    });
  } catch (error) {
    return handleServerError(res, error);
  }
};

export const getMyVehicles = async (req, res) => {
  try {
    const user_id = req.user.id;

    const [vehicles] = await connection.execute(
      `
      SELECT *
      FROM vehicles
      WHERE user_id = ?
      ORDER BY created_at DESC
      `,
      [user_id],
    );

    return res.json({
      success: true,
      data: vehicles,
    });
  } catch (err) {
    return handleServerError(res, err, "GET_MY_VEHICLES_ERROR");
  }
};

export const getVehicleById = async (req, res) => {
  try {
    const { id } = req.params;

    const [vehicles] = await connection.execute(
      `
      SELECT *
      FROM vehicles
      WHERE id = ?
      `,
      [id],
    );

    if (vehicles.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Vehicle tidak ditemukan",
      });
    }

    const vehicle = vehicles[0];

    if (vehicle.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Forbidden",
      });
    }

    return res.json({
      success: true,
      data: vehicle,
    });
  } catch (err) {
    return handleServerError(res, err, "GET_VEHICLE_BY_ID_ERROR");
  }
};

export const updateVehicle = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      brand,
      model,
      year,
      license_plate,
      mileage,
      transmission,
      engine_type,
    } = req.body;

    const [vehicles] = await connection.execute(
      `
      SELECT *
      FROM vehicles
      WHERE id = ?
      `,
      [id],
    );

    if (vehicles.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Vehicle tidak ditemukan",
      });
    }

    const vehicle = vehicles[0];

    if (vehicle.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Forbidden",
      });
    }

    if (!brand || !model || !year || !license_plate) {
      return res.status(400).json({
        success: false,
        message: "Brand, model, year, dan license plate wajib diisi",
      });
    }

    const image = req.file ? `/uploads/${req.file.filename}` : vehicle.image;

    await connection.execute(
      `
      UPDATE vehicles
      SET
        brand = ?,
        model = ?,
        year = ?,
        license_plate = ?,
        mileage = ?,
        transmission = ?,
        engine_type = ?,
        image = ?
      WHERE id = ?
      `,
      [
        brand,
        model,
        year,
        license_plate,
        mileage !== undefined && mileage !== "" ? mileage : vehicle.mileage,
        transmission !== undefined && transmission !== ""
          ? transmission
          : vehicle.transmission,
        engine_type !== undefined && engine_type !== ""
          ? engine_type
          : vehicle.engine_type,
        image,
        id,
      ],
    );

    const [updatedVehicles] = await connection.execute(
      `
      SELECT *
      FROM vehicles
      WHERE id = ?
      `,
      [id],
    );

    return res.json({
      success: true,
      message: "Vehicle berhasil diupdate",
      data: updatedVehicles[0],
    });
  } catch (err) {
    return handleServerError(res, err, "UPDATE_VEHICLE_ERROR");
  }
};

export const deleteVehicle = async (req, res) => {
  try {
    const { id } = req.params;

    const [vehicles] = await connection.execute(
      `
      SELECT *
      FROM vehicles
      WHERE id = ?
      `,
      [id],
    );

    if (vehicles.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Vehicle tidak ditemukan",
      });
    }

    const vehicle = vehicles[0];

    if (vehicle.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Forbidden",
      });
    }

    await connection.execute(
      `
      DELETE FROM vehicles
      WHERE id = ?
      `,
      [id],
    );

    return res.json({
      success: true,
      message: "Vehicle berhasil dihapus",
    });
  } catch (err) {
    return handleServerError(res, err, "DELETE_VEHICLE_ERROR");
  }
};
