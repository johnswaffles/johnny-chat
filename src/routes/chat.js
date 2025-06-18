import { Router } from "express";
import { chat }   from "../services/chatService.js";

const router = Router();

/**
 * POST /bots/:bot/chat
 * body: { history:[{role,content,…}], user:"last user message" }
 * returns: { content:"assistant reply" }
 */
router.post("/bots/:bot/chat", async (req, res) => {
  try {
    const { bot }        = req.params;              // "story", "assistant", …
    const { history,user }= req.body;

    const answer = await chat(bot, history, user);
    res.json({ content: answer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
