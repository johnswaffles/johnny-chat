import express from "express";
import cors from "cors";
import { router as chatRouter } from "./routes/chat.js";
import { router as ttsRouter } from "./routes/tts.js";
import { router as imageRouter } from "./routes/image.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "6mb" }));

app.use(chatRouter);
app.use(ttsRouter);
app.use(imageRouter);

export { app };
