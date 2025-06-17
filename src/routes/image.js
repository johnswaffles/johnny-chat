import express from "express";
import { openai } from "../core/openai.js";

export const router = express.Router();

router.post("/image", async (req, res) => {
  try {
    const { sessionId = "anon", prompt = "", style = "" } = req.body;
    const img = await openai.images.generate({
  model: "gpt-image-1",
  prompt,
  size: "1024x1024",
  quality: "high",
  n: 1,
  user: sessionId
}) ` : ""}${prompt}`.trim(),
      size: "1024x1024",
      quality: "medium",
      n: 1
    });

    res.json({ b64: img.data[0].b64_json });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
