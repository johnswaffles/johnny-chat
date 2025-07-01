/*  server.js – Just Ask Johnny backend
    ────────────────────────────────────
    ▸ ESM modules (Node 22+)
    ▸ CORS (Squarespace & localhost)
    ▸ JSON + multipart (for image uploads / vision)
    ▸ Routes mounted under /api
*/

import express from "express";
import dotenv   from "dotenv";
import cors     from "cors";
import multiparty from "multiparty";             // ← npm i multiparty
import fs      from "fs/promises";
import chatRouter from "./routes/chat.js";       // text / vision / image-gen

dotenv.config();

const {
  PORT           = 10_000,                       // Render picks its own port – keep this fallback for local dev
  ALLOWED_ORIGIN = "http://localhost:3000,https://www.justaskjohnny.com",
} = process.env;

const app = express();

/*───────────────────────────────────────────────────────────────────────────
  Middleware
  ──────────────────────────────────────────────────────────────────────────*/
app.use(
  cors({
    origin: ALLOWED_ORIGIN.split(",").map(s => s.trim()),
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
  }),
);

app.use(express.json({ limit: "10mb" }));        // JSON bodies (chat requests)

/* optional multipart endpoint if you want to POST raw images
   Squarespace uses XMLHttpRequest → FormData for uploads, so we expose /api/upload
   and return a base64 data-URL that front-end can immediately hand to /api/chat
*/
app.post("/api/upload", (req, res) => {
  const form = new multiparty.Form();
  form.parse(req, async (err, fields, files) => {
    try {
      if (err) throw err;
      const file = files?.image?.[0];
      if (!file) return res.status(400).json({ error: "No image file found (name it 'image')" });

      const buffer = await fs.readFile(file.path);
      const b64    = buffer.toString("base64");
      // Example data-URL – front-end should send this under input.image_url
      const dataURL = `data:${file.headers["content-type"]};base64,${b64}`;
      res.json({ dataURL });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });
});

/*───────────────────────────────────────────────────────────────────────────
  Chat / Vision / Image-generation routes
  ──────────────────────────────────────────────────────────────────────────*/
app.use("/api", chatRouter);

/* Health-check route (handy for Render) */
app.get("/", (_req, res) => res.send("Just Ask Johnny API 💜"));

/*───────────────────────────────────────────────────────────────────────────*/
app.listen(PORT, () => console.log(`✅  Server running on port ${PORT}`));
