const express           = require("express");
const { generateImage } = require("../services/imageService");

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const out = await generateImage(req.body);   // { b64 }
    res.json(out);
  } catch (err) {
    console.error("image:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
