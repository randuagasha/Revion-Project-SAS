import connection from "../database.js";

import { handleServerError } from "../utils/errorHandler.js";
import { isNotEmpty, isValidYear, isInEnum } from "../utils/validation.js";

export const createVehicle = async (req, res) => {
  try {
    const {
      brand,
      model,
      year,
      license_plate,
      mileage,
      transmission,
      engine_type,
    } = req.body;

    if (
      !isNotEmpty(brand) ||
      !isNotEmpty(model) ||
      !isNotEmpty(year) ||
      !isNotEmpty(license_plate)
    ) {
      return res.status(400).json({
        success: false,
        message: "Field wajib belum lengkap",
      });
    }

    if (!isValidYear(year)) {
      return res.status(400).json({
        success: false,
        message: "Tahun kendaraan tidak valid",
      });
    }

    if (transmission && !isInEnum(transmission, ["manual", "automatic"])) {
      return res.status(400).json({
        success: false,
        message: "Transmission tidak valid",
      });
    }

    const user_id = req.user.id;

    const image = req.file ? req.file.filename : null;

    await connection.execute(
      `
      INSERT INTO vehicles
      (
        user_id,
        brand,
        model,
        year,
        license_plate,
        mileage,
        transmission,
        engine_type,
        image
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        user_id,
        brand,
        model,
        year,
        license_plate,
        mileage,
        transmission,
        engine_type,
        image,
      ],
    );

    return res.status(201).json({
      success: true,
      message: "Vehicle berhasil ditambahkan",

      image_url: image
        ? `${req.protocol}://${req.get("host")}/uploads/${image}`
        : null,
    });
  } catch (err) {
    return handleServerError(res, err, "CREATE_VEHICLE_ERROR");
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

    const formattedVehicles = vehicles.map((vehicle) => ({
      ...vehicle,

      image_url: vehicle.image
        ? `${req.protocol}://${req.get("host")}/uploads/${vehicle.image}`
        : null,
    }));

    return res.json({
      success: true,
      data: formattedVehicles,
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

      data: {
        ...vehicle,

        image_url: vehicle.image
          ? `${req.protocol}://${req.get("host")}/uploads/${vehicle.image}`
          : null,
      },
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

    const image = req.file ? req.file.filename : vehicle.image;

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
        mileage,
        transmission,
        engine_type,
        image,
        id,
      ],
    );

    return res.json({
      success: true,
      message: "Vehicle berhasil diupdate",

      image_url: image
        ? `${req.protocol}://${req.get("host")}/uploads/${image}`
        : null,
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
