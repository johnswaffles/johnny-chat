/* routes/chat.js  ── o4-mini text  +  gpt-4.1-mini vision  ── */

import { Router }   from 'express';
import multer       from 'multer';
import OpenAI       from 'openai';

const router = Router();
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } });      // ≤ 10 MB

/* --- env ----------------------------------------------------------------- */
const {
  OPENAI_API_KEY,
  TEXT_MODEL   = 'o4-mini',
  VISION_MODEL = 'gpt-4.1-mini'
} = process.env;

/* --- OpenAI client ------------------------------------------------------- */
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY
});

const BETA_HDR = 'assistants=v2';

/* ------------------------------------------------------------------------ */
/*  /chat  – text only OR text + single image                               */
/* ------------------------------------------------------------------------ */
router.post(
  '/chat',
  upload.single('file'),                                // <input type="file" name="file" />
  async (req, res) => {
    try {
      const { input } = req.body;
      if (!input) return res.status(400).json({ error: 'input required' });

      /* ---------- decide which model & build input array ----------------- */
      const inArr = [{ role: 'user', content: [{ type: 'input_text', text: input }] }];

      let model = TEXT_MODEL;

      if (req.file) {
        // Vision path – convert buffer → base64 data-URL
        const b64 = req.file.buffer.toString('base64');
        const mime = req.file.mimetype || 'image/png';
        inArr[0].content.push({
          type: 'input_image',
          image_url: `data:${mime};base64,${b64}`
        });
        model = VISION_MODEL;
      }

      /* ---------- call OpenAI Responses API ------------------------------ */
      const response = await openai.responses.create({
        model,
        input: inArr,
        tools: [{ type: 'web_search' }],          // text model gets search, vision ignores
        temperature: 1,
      }, {
        headers: { 'OpenAI-Beta': BETA_HDR }
      });

      /* ---------- extract assistant reply -------------------------------- */
      const first = response.output?.[0];
      const text  = first?.content?.[0]?.text ?? '*no reply*';

      return res.json({ reply: text });

    } catch (err) {
      /* ---------- log & 500 --------------------------------------------- */
      console.error('🟥 /chat failed', {
        msg:   err.message,
        code:  err.code,
        data:  err.response?.data
      });
      res.status(500).json({ error: err.message });
    }
  }
);

export default router;
