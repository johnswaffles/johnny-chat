// routes/chat.js  ── o4-mini chat + gpt-4.1-mini vision
import { Router } from "express";
import multer from "multer";
import OpenAI from "openai";

const router      = Router();
const upload      = multer();                 // memory storage
const openai      = new OpenAI();
const TEXT_MODEL  = process.env.TEXT_MODEL  || "o4-mini";
const VISION_MODEL= process.env.VISION_MODEL|| "gpt-4.1-mini";
const BETA_HDR    = process.env.OPENAI_BETA || "assistants=v2";

/* ------------- text chat ------------------------------------------------ */
router.post("/chat", async (req, res) => {
  try {
    const { input } = req.body;
    if (!input) return res.status(400).json({ error: "input required" });

    const response = await openai.responses.create({
      model: TEXT_MODEL,
      input,
      tools: [{ type: "web_search" }]
    },{
      headers: { "OpenAI-Beta": BETA_HDR }
    });

    const reply = response.output_text || response.choices?.[0]?.message?.content?.[0]?.text;
    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "OpenAI error" });
  }
});

/* ------------- image upload (vision) ------------------------------------ */
router.post("/vision", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "image required" });

    const b64 = req.file.buffer.toString("base64");
    const dataUrl = `data:${req.file.mimetype};base64,${b64}`;

    const response = await openai.responses.create({
      model: VISION_MODEL,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text",  text: req.body.prompt || "What’s in this image?" },
            { type: "input_image", image_url: dataUrl }
          ]
        }
      ]
    },{
      headers: { "OpenAI-Beta": BETA_HDR }
    });

    res.json({ reply: response.output_text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "OpenAI error" });
  }
});

export default router;
