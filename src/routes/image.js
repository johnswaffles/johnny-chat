/**
 * POST /image   – GPT‑Image‑1, quality high
 */
import express from "express";
import { openai } from "../core/openai.js";

export const router = express.Router();
const sessions = new Map();

router.post("/image", async (req, res) => {
  try {
    const { sessionId = crypto.randomUUID(), prompt = "", style = "" } = req.body;
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

    const { id, b64_json } = rsp.data[0];
    sessions.set(sessionId, id);
    res.json({ b64: b64_json });
  } catch (err) {
    /*  ↓↓↓  PRINT *AND* RETURN the raw OpenAI error  */
    const msg = err.response?.data?.error?.message ?? err.message;
    console.error("Image route:", msg);
    res.status(500).json({ error: msg });
  }
});
