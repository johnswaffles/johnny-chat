import express from "express";
import cors    from "cors";
import chatAPI from "./routes/chat.js";
import "dotenv/config";

const app  = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json({ limit: "10mb" }));          // large enough for base-64 img
app.use("/api", chatAPI);

app.get("/", (_, res) => res.send("Johnny backend ✅"));
app.listen(PORT, () => console.log("Listening on", PORT));
