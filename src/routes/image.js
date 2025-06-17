/**
 * High-quality GPT-Image-1 illustration endpoint
 * POST /image  { sessionId?, prompt, style? }
 * → { b64 }
 */
import express from "express";
import { openai } from "../core/openai.js";

export const router = express.Router();
const sessions = new Map();                 // remember last image per user

router.post("/image", async (req, res) => {
  try {
    const { sessionId = crypto.randomUUID(), prompt = "", style = "" } = req.body;
    const prev = sessions.get(sessionId);

    const img = await openai.images.generate({
      model:   "gpt-image-1",
      prompt:  `${style ? `(${style}) ` : ""}${prompt}`.trim(),
      size:    "1024x1024",
      quality: "high",
      n:       1,
      ...(prev && { previous_response_id: prev }),
      user:    sessionId
    });

    const b64 = img.data[0].b64_json;
    sessions.set(sessionId, img.data[0].id);   // store id for continuity
    res.json({ b64 });
  } catch (err) {
    console.error("Image error:", err.response?.data || err);
    res.status(500).json({ error: err.message });
  }
});
