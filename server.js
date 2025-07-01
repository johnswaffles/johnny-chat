import express from "express";
import cors    from "cors";
import dotenv  from "dotenv";
dotenv.config();

const app  = express();
const port = process.env.PORT || 3000;

// ── middleware ───────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// mount routes
import chatRoute from "./routes/chat.js";
app.use("/api", chatRoute);

// ping
app.get("/", (_req, res) => res.send("Johnny-Chat backend OK"));

// start
app.listen(port, () => console.log(`Johnny-Chat listening on :${port}`));
