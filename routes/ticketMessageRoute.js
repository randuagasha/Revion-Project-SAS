import express from "express";

import {
  sendTicketMessage,
  getTicketMessages,
} from "../controllers/ticketMessageController.js";

import { authMiddleware } from "../middlewares/authMiddleware.js";

import { upload } from "../middlewares/uploadMiddleware.js";

const router = express.Router();

router.post(
  "/",
  authMiddleware,
  upload.single("attachment"),
  sendTicketMessage,
);

router.get("/:ticketId", authMiddleware, getTicketMessages);

export default router;
