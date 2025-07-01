/* server.js — minimal */

import express from "express";
import cors    from "cors";
import dotenv  from "dotenv";
import chat    from "./routes/chat.js";

dotenv.config();
const app = express();

app.use(cors());              // allow Squarespace origin
app.use(express.json({limit:"12mb"}));
app.use("/api", chat);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("Johnny-Chat up on", PORT));
