/* routes/chat.js ─ text, image-gen & vision (gpt-4-1-mini)
   ───────────────────────────────────────────────────────── */

import { Router } from "express";
import fetch from "node-fetch";     // node 18+  → “node-fetch@3”
import OpenAI from "openai";

const router = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const TEXT_MODEL   = process.env.TEXT_MODEL   || "o4-mini";
const IMAGE_MODEL  = process.env.IMAGE_MODEL  || "gpt-image-1";
const VISION_MODEL = process.env.VISION_MODEL || "gpt-4-1-mini"; // multi-modal

/* A *very* small heuristic:
   ─ if user sent an image_url (or data-URL) ➜ vision
   ─ elseif prompt looks like “draw/make/create an image/picture/photo/…”
     ➜ image generation
   ─ else regular text model
*/
function chooseMode({ input, image_url }) {
  if (image_url) return "vision";
  const trigger = /(generate|create|draw|make).*(image|picture|photo|logo|icon)/i;
  return trigger.test(input) ? "image" : "text";
}

/*──────── POST /api/chat ─────────*/
router.post("/chat", async (req, res) => {
  try {
    const { input = "", image_url } = req.body;
    if (!input && !image_url) {
      return res.status(400).json({ error: "input text or image_url required" });
    }

    const mode = chooseMode({ input, image_url });

    let response;

    /*──────────────────────────────── TEXT ───────────────────────────────*/
    if (mode === "text") {
      response = await openai.chat.completions.create({
        model: TEXT_MODEL,
        tools: [{ type: "web_search" }],
        messages: [{ role: "user", content: input }],
      });

      const text = response.choices[0].message.content;
      return res.json({ reply: text });
    }

    /*───────────────────────────── IMAGE-GEN ─────────────────────────────*/
    if (mode === "image") {
      response = await openai.responses.create({
        model: IMAGE_MODEL,
        input,
        tools: [{ type: "image_generation" }],
      });

      const imgCall = response.output.find(o => o.type === "image_generation_call");

      if (!imgCall) throw new Error("image_generation_call not found");

      return res.json({
        reply: "Here you go!",
        image_base64: imgCall.image,
        mimetype: "image/png",
      });
    }

    /*──────────────────────────────── VISION ─────────────────────────────*/
    // mode === "vision"
    response = await openai.responses.create({
      model: VISION_MODEL,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text",  text: input || "What’s in this image?" },
            { type: "input_image", image_url },
          ],
        },
      ],
    });

    const visionText = response.output_text;
    return res.json({ reply: visionText });
  } catch (err) {
    console.error("OpenAI error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
