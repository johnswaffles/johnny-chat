import { Router } from "express";
import OpenAI      from "openai";

const router = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.post("/chat", async (req, res) => {
  try {
    const { input, conversation_id, model = "o4-mini" } = req.body;
    if (!input) return res.status(400).json({ error: "input required" });

    /*  Call the new Responses endpoint  */
    const oa = await openai.beta.responses.create({
      model,
      input,
      conversation_id: conversation_id ?? "new",
      tools: [{ type: "web_search" }]
    });

    const reply = oa.choices[0].message.content[0].text;
    res.json({ reply, conversation_id: oa.conversation_id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;   // <— default export required by server.js
