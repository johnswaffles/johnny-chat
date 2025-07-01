// -------------------------------------------
// Just Ask Johnny – back-end (Express)
// -------------------------------------------
import express from "express";
import dotenv  from "dotenv";
dotenv.config();

const app  = express();
const PORT = process.env.PORT || 10_000;

app.use(express.json({ limit: "10mb" }));
app.use(express.static("public"));

// ---------- helper ----------
const OPENAI_URL = "https://api.openai.com/v1/responses";
const HEADERS = {
  Authorization : `Bearer ${process.env.OPENAI_API_KEY}`,
  "Content-Type": "application/json",
};

// very naive heuristic: “create / generate an image / picture / photo…”
const looksLikeImageRequest = txt =>
  /\b(create|generate|make|draw|paint|photo|picture|illustration|logo|wallpaper)\b.*\b(image|picture|photo|art|logo)\b/i.test(
    txt
  );

// ---------- /chat ----------
app.post("/api/chat", async (req, res) => {
  const { input } = req.body;
  if (!input?.trim()) return res.status(400).json({ error: "input required" });

  try {
    /* -------------------------------------------------
       1) decide which OpenAI model + tools we need
    ------------------------------------------------- */
    let model, body;

    // ──--- Image generation ---───────────────────────
    if (looksLikeImageRequest(input)) {
      model = "gpt-image-1";
      body = {
        model,
        input,
        tools: [{ type: "image_generation" }],
      };
    }
    // ──--- Vision / describe uploaded image ---────────
    else if (req.body.imageUrl) {
      model = "gpt-4-1-mini";
      body = {
        model,
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: input },
              { type: "input_image", image_url: req.body.imageUrl },
            ],
          },
        ],
      };
    }
    // ──--- Normal chat with live web search ---────────
    else {
      model = "o4-mini";
      body = {
        model,
        input,
        tools: [{ type: "web_search" }],
      };
    }

    /* -------------------------------------------------
       2) call Responses API
    ------------------------------------------------- */
    const r = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { ...HEADERS, "OpenAI-Beta": "assistants=v2" },
      body: JSON.stringify(body),
    });

    if (!r.ok) throw await r.json();

    const data   = await r.json();
    const output = data.output || data.choices?.[0]?.message?.content;

    /* -------------------------------------------------
       3) unwrap output
    ------------------------------------------------- */
    let reply        = "";
    let imageBase64  = null;

    for (const item of output) {
      if (item.type === "output_text") reply += item.text;
      if (item.type === "image_generation_call") imageBase64 = item.image_base64;
    }

    res.json({ reply, imageBase64 });
  } catch (err) {
    console.error("OpenAI error:", err);
    const msg = err.error?.message || err.message || "OpenAI error";
    res.status(500).json({ error: msg });
  }
});

app.listen(PORT, () => console.log(`✅  Server running on ${PORT}`));
