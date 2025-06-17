import express from "express";
import { openai } from "../core/openai.js";

export const router = express.Router();

router.post("/speech", async (req, res) => {
  try {
    const text = (req.body.text || "").trim();
    if (!text) return res.status(400).json({ error: "text is required" });
    const voice = req.body.voice || "shimmer";

    const audio = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice,
      input: text,
      format: "mp3"
    });

    const mp3 = Buffer.from(await audio.arrayBuffer()).toString("base64");
    res.json({ audio: mp3 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
