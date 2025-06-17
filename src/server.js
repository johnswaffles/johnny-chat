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

/* mount paths */
app.use("/chat",   chatRouter);    //  POST /chat
app.use("/image",  imageRouter);   //  POST /image
app.use("/speech", ttsRouter);     //  POST /speech

/* start server */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅  API ready on :${PORT}`));
