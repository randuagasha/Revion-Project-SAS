import express from "express";

import { getProfile, updateProfile } from "../controllers/userController.js";

import { authMiddleware } from "../middlewares/authMiddleware.js";

import { upload } from "../middlewares/uploadMiddleware.js";

const router = express.Router();

router.get("/me", authMiddleware, getProfile);

router.put(
  "/me",
  authMiddleware,
  upload.single("profile_image"),
  updateProfile,
);

export default router;
