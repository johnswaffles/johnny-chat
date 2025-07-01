// server.js  ── entry point
import "dotenv/config";
import express from "express";
import cors from "cors";

import chatRouter from "./routes/chat.js";

const PORT = process.env.PORT || 10_000;

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));      // ◀ allow JSON body

app.use("/api", chatRouter);                  // →  /api/chat

app.listen(PORT, () => {
  console.log(`⚡  Johnny-Chat listening on ${PORT}`);
});
