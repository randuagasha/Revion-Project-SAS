import express from "express";

import {
  createTicket,
  getTickets,
  getTicketById,
  updateTicketStatus,
} from "../controllers/ticketController.js";

import { authMiddleware } from "../middlewares/authMiddleware.js";

import { roleMiddleware } from "../middlewares/roleMiddleware.js";

const router = express.Router();

router.post("/", authMiddleware, createTicket);

router.get("/", authMiddleware, getTickets);

router.get("/:id", authMiddleware, getTicketById);

router.put(
  "/:id/status",
  authMiddleware,
  roleMiddleware("mechanic", "super_admin"),
  updateTicketStatus,
);

export default router;
