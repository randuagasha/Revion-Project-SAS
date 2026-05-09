import express from "express";

import {
  getAdminDashboard,
  getMechanicDashboard,
  getCustomerDashboard,
} from "../controllers/dashboardController.js";

import { authMiddleware } from "../middlewares/authMiddleware.js";

import { roleMiddleware } from "../middlewares/roleMiddleware.js";

const router = express.Router();

router.get(
  "/admin",
  authMiddleware,
  roleMiddleware("super_admin"),
  getAdminDashboard,
);

router.get(
  "/mechanic",
  authMiddleware,
  roleMiddleware("mechanic"),
  getMechanicDashboard,
);

router.get(
  "/customer",
  authMiddleware,
  roleMiddleware("customer"),
  getCustomerDashboard,
);

export default router;
