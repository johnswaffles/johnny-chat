/**
 * GPT-Image-1 (high) endpoint
 * POST /image   { sessionId?, prompt, style? }
 * Returns       { b64 }
 */
import express from "express";
import crypto from "node:crypto";
import { openai } from "../core/openai.js";

export const router = express.Router();
const sessions = new Map();

router.post("/", async (req, res) => {
  try {
    const { sessionId = crypto.randomUUID(), prompt = "", style = "" } = req.body;
    if (!prompt.trim()) return res.status(400).json({ error: "prompt is required" });

    const prev = sessions.get(sessionId);

    const rsp = await openai.images.generate({
      model:  "gpt-image-1",
      prompt: `${style ? `(${style}) ` : ""}${prompt}`.trim(),
      size:   "1024x1024",
      quality:"high",
      n:      1,
      ...(prev && { previous_response_id: prev }),
      response_format: "b64_json",
      user:   sessionId
    });

    const frame = rsp.data[0];
    sessions.set(sessionId, frame.id);
    res.json({ b64: frame.b64_json });
  } catch (err) {
    const msg = err.response?.data?.error?.message ?? err.message;
    console.error("Image route:", msg);
    res.status(500).json({ error: msg });
  }
});
