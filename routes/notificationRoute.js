import express from "express";

import {
  getMyNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from "../controllers/notificationController.js";

import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/", authMiddleware, getMyNotifications);

router.get("/unread-count", authMiddleware, getUnreadNotificationCount);

router.put("/read-all", authMiddleware, markAllNotificationsAsRead);

router.put("/:id/read", authMiddleware, markNotificationAsRead);

router.delete("/:id", authMiddleware, deleteNotification);

export default router;
