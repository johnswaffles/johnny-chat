/* server.js  –– minimal Express wrapper */
import express  from "express";
import cors     from "cors";
import chatRoutes from "./routes/chat.js";

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "2mb" }));     // Squarespace sends JSON
app.use("/api", chatRoutes);

app.get("/", (_, res) => res.send("Johnny-Chat API v2 running."));

app.listen(PORT, () => console.log(`API listening on :${PORT}`));
