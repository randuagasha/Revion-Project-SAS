import express from "express";

import {
  createBookingProgress,
  getBookingProgressByBookingId,
} from "../controllers/bookingProgressController.js";

import { authMiddleware } from "../middlewares/authMiddleware.js";

import { roleMiddleware } from "../middlewares/roleMiddleware.js";

import { upload } from "../middlewares/uploadMiddleware.js";

const router = express.Router();

router.post(
  "/",
  authMiddleware,
  roleMiddleware("mechanic", "super_admin"),
  upload.array("images", 5),
  createBookingProgress,
);

router.get("/:bookingId", authMiddleware, getBookingProgressByBookingId);

export default router;
