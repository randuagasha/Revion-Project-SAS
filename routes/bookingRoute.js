import express from "express";

import {
  createBooking,
  getMyBookings,
  getMechanicBookings,
  getAllBookings,
  getBookingById,
  getMechanicIncomingBookings,
  getMechanicCompletedBookings,
  updateBookingStatus,
  deleteBooking,
  acceptBookingByMechanic,
} from "../controllers/bookingController.js";

import { authMiddleware } from "../middlewares/authMiddleware.js";

import { roleMiddleware } from "../middlewares/roleMiddleware.js";

import { upload } from "../middlewares/uploadMiddleware.js";

const router = express.Router();

router.post("/", authMiddleware, upload.array("images", 5), createBooking);

router.get("/my", authMiddleware, getMyBookings);

router.get(
  "/mechanic/incoming",
  authMiddleware,
  roleMiddleware("mechanic"),
  getMechanicIncomingBookings,
);

router.get(
  "/mechanic/completed",
  authMiddleware,
  roleMiddleware("mechanic"),
  getMechanicCompletedBookings,
);

router.get(
  "/mechanic",
  authMiddleware,
  roleMiddleware("mechanic"),
  getMechanicBookings,
);

router.get("/", authMiddleware, roleMiddleware("super_admin"), getAllBookings);

router.put(
  "/:id/accept",
  authMiddleware,
  roleMiddleware("mechanic"),
  acceptBookingByMechanic,
);

router.put("/:id/status", authMiddleware, updateBookingStatus);

router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware("super_admin"),
  deleteBooking,
);

router.get("/:id", authMiddleware, getBookingById);

export default router;
