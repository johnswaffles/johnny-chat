const express     = require("express");
const { chat }    = require("../services/chatService");
const router = express.Router();

router.post("/", async (req, res) => {
  try { const out = await chat(req.body); res.json(out); }
  catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});

module.exports = router;
