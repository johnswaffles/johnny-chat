import express from "express";
import cors     from "cors";
import "dotenv/config.js";
import chatRoute from "./routes/chat.js";

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api", chatRoute);      // POST /api/chat
app.use(express.static("public"));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("Server running on port", PORT));
