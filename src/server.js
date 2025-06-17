import "dotenv/config";
import express from "express";
import cors from "cors";

/* route modules */
import { router as chatRouter }   from "./routes/chat.js";
import { router as imageRouter }  from "./routes/image.js";
import { router as ttsRouter }    from "./routes/tts.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "6mb" }));

/* ───── plain paths ───── */
app.use("/chat",   chatRouter);
app.use("/image",  imageRouter);
app.use("/speech", ttsRouter);

/* ───── legacy “/bots/:bot/…” aliases ───── */
app.use("/bots/:bot/chat",   chatRouter);
app.use("/bots/:bot/image",  imageRouter);
app.use("/bots/:bot/speech", ttsRouter);

/* start server */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅  API ready on :${PORT}`));
