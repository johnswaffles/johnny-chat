/* ─ server.js ───────────────────────────────
   Express backend for Johnny Chat (o4-mini + web_search)
   ─────────────────────────────────────────── */

import express from "express";
import cors    from "cors";
import "dotenv/config.js";
import chatRoute from "./routes/chat.js";

const app = express();

/* ---------- CORS (must be first) ---------- */
app.use(
  cors({
    origin: "*",                 // allow Squarespace or any origin
    methods: ["POST"],
    allowedHeaders: ["Content-Type"],
  })
);

/* ---------- middleware & routes ---------- */
app.use(express.json());
app.use("/api", chatRoute);

/* ---------- start server ---------- */
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("Server running on port", PORT));
