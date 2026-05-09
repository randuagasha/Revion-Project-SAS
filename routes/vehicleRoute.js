import express from "express";

import {
  createVehicle,
  getMyVehicles,
  getVehicleById,
  updateVehicle,
  deleteVehicle,
} from "../controllers/vehicleController.js";

import { authMiddleware } from "../middlewares/authMiddleware.js";

import { upload } from "../middlewares/uploadMiddleware.js";

const router = express.Router();

router.post("/", authMiddleware, upload.single("image"), createVehicle);

router.get("/", authMiddleware, getMyVehicles);

router.get("/:id", authMiddleware, getVehicleById);

router.put("/:id", authMiddleware, upload.single("image"), updateVehicle);

router.delete("/:id", authMiddleware, deleteVehicle);

export default router;
