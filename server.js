import "dotenv/config";
import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// ─── OpenAI client ────────────────────────────────────────────────────────────
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY    // make sure this is set on Render
});

// ─── /chat  ───────────────────────────────────────────────────────────────────
app.post("/chat", async (req, res) => {
  try {
    // tutor-front-end sends {user_input, last_id}
    const { user_input, last_id } = req.body || {};

    if (!user_input) {
      return res.status(400).json({ error: "user_input required" });
    }

    const systemPrompt =
      "You are AdaptiveTutor GPT. Begin a 5-question multiple-choice quiz. "
      + "Correct → next question. Wrong → mini-lesson (≤120 words) then next. "
      + "Finish with percent score + recap (≤200 words) and a follow-up prompt.";

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user",   content: user_input }
    ];

    const chat = await openai.chat.completions.create({
      model: "gpt-4.1-nano",
      messages,
      temperature: 0.7
    });

    const answer = chat.choices?.[0]?.message?.content || "(no reply)";
    res.json({ id: chat.id, answer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "internal error" });
  }
});

// ─── /speech  ─────────────────────────────────────────────────────────────────
app.post("/speech", async (req, res) => {
  try {
    const { text, voice = "alloy" } = req.body || {};
    if (!text) return res.status(400).json({ error: "text required" });

    const speech = await openai.audio.speech.create({
      model: "gpt-4o-audio-preview",
      voice,
      input: text,
      format: "mp3"
    });

    const b64 = Buffer.from(await speech.arrayBuffer()).toString("base64");
    res.json({ audio: b64 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "tts error" });
  }
});

// ─── Launch ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅  API ready on :${PORT}`));
