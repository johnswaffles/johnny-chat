import express from "express";
import { chat } from "../services/chatService.js";

export const router = express.Router();

router.post("/bots/:id/chat", async (req, res, next) => {
  try {
    const { history = [], user } = req.body;
    if (!user) return res.status(400).json({ error: "user is required" });

    const result = await chat(req.params.id, history, user);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

