import express    from "express";
import cors       from "cors";

import chatRoutes  from "./routes/chat.js";
import imageRoutes from "./routes/image.js";
import ttsRoutes   from "./routes/tts.js";

const app  = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// mount routers (they already contain their own paths)
app.use(chatRoutes);
app.use(imageRoutes);
app.use(ttsRoutes);

// simple health-check
app.get("/", (_, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`✅  API ready on :${PORT}`));
