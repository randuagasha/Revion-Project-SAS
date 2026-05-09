import express from "express";

import {
  createService,
  getAllServices,
  getServiceById,
  updateService,
  deleteService,
} from "../controllers/serviceController.js";

import { authMiddleware } from "../middlewares/authMiddleware.js";

import { roleMiddleware } from "../middlewares/roleMiddleware.js";

const router = express.Router();

router.post("/", authMiddleware, roleMiddleware("super_admin"), createService);

router.get("/", authMiddleware, getAllServices);

router.get("/:id", authMiddleware, getServiceById);

router.put(
  "/:id",
  authMiddleware,
  roleMiddleware("super_admin"),
  updateService,
);

router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware("super_admin"),
  deleteService,
);

export default router;
