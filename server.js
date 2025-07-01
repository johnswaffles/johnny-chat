/* ---------------------------------------------------------
   server.js  — Express API for “Just Ask Johnny”
   ---------------------------------------------------------
   • CORS: allows Squarespace front-end only
   • JSON body-parsing
   • Route  /api/chat      → ./routes/chat.js   (o4-mini text + gpt-4.1-mini vision + gpt-image-1)
   • Health /             → simple “OK” check
----------------------------------------------------------*/

import express from "express";
import cors    from "cors";
import dotenv  from "dotenv";
import chatRoute from "./routes/chat.js";

dotenv.config();

const app  = express();
const PORT = process.env.PORT || 10000;

/* ----------  CORS for Squarespace  ---------- */
app.use(
  cors({
    origin : "https://www.justaskjohnny.com",     // ← put your live Squarespace URL here
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false,
    preflightContinue: false
  })
);

/* Express automatically answers the OPTIONS pre-flight */
app.options("*", cors());

/* ----------  middleware  ---------- */
app.use(express.json({ limit: "8mb" }));          // allow image base64 in vision calls

/* ----------  routes  ---------- */
app.get("/", (_req, res) => res.send("Just Ask Johnny backend: OK"));
app.use("/api", chatRoute);

/* ----------  start  ---------- */
app.listen(PORT, () => {
  console.log(`⚡  Johnny-chat server running on port ${PORT}`);
});
