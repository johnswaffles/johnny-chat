const express            = require("express");
const { textToSpeech }   = require("../services/ttsService");

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const out = await textToSpeech(req.body);    // { audio }
    res.json(out);
  } catch (err) {
    console.error("tts:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
