import express from "express";
import cors    from "cors";
import chatRoute from "./routes/chat.js";
import "dotenv/config";

const app  = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json({ limit: "4mb" }));           // allow base-64 images
app.use("/api", chatRoute);

app.get("/", (_, res) => res.send("Johnny backend up ✅"));
app.listen(PORT, () => console.log("Server running on", PORT));
