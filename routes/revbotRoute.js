import express from "express";

import { chatWithRevBot } from "../controllers/revbotController.js";

import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/chat", authMiddleware, chatWithRevBot);

export default router;