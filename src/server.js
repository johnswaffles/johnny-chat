require("dotenv").config();
const express = require("express");
const cors    = require("cors");

const chatRouter  = require("./routes/chat");
const imageRouter = require("./routes/image");
const ttsRouter   = require("./routes/tts");

const app = express();
app.use(cors());
app.use(express.json({ limit: "6mb" }));

/* plain paths */
app.use("/chat",   chatRouter);
app.use("/image",  imageRouter);
app.use("/speech", ttsRouter);

/* legacy aliases so Squarespace keeps working */
app.use("/bots/:bot/chat",   chatRouter);
app.use("/bots/:bot/image",  imageRouter);
app.use("/bots/:bot/speech", ttsRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅  API ready on :${PORT}`));
