import express from "express";

import {
  createBooking,
  getMyBookings,
  getMechanicBookings,
  getAllBookings,
  getBookingById,
  updateBookingStatus,
  deleteBooking,
} from "../controllers/bookingController.js";

import { authMiddleware } from "../middlewares/authMiddleware.js";

import { roleMiddleware } from "../middlewares/roleMiddleware.js";

import { upload } from "../middlewares/uploadMiddleware.js";

const router = express.Router();

router.post("/", authMiddleware, upload.array("images", 5), createBooking);

router.get("/my", authMiddleware, getMyBookings);

router.get(
  "/mechanic",
  authMiddleware,
  roleMiddleware("mechanic"),
  getMechanicBookings,
);
router.get("/", authMiddleware, roleMiddleware("super_admin"), getAllBookings);

router.put(
  "/:id/status",
  authMiddleware,
  roleMiddleware("mechanic", "super_admin"),
  updateBookingStatus,
);

router.get("/:id", authMiddleware, getBookingById);

router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware("super_admin"),
  deleteBooking,
);

export default router;
