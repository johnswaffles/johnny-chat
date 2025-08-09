// server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import multer from 'multer';
import { lookup as lookupMime } from 'mime-types';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

dotenv.config();
const PORT = process.env.PORT || 3000;
const CONFIGURED_MODEL = process.env.CHAT_MODEL || 'gpt-5-mini';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cors({ origin: '*' }));

// Multer setup
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

// Extract text from PDF
async function extractPdfText(buffer) {
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(it => it.str).join(' ') + '\n';
  }
  return text.trim();
}

// Chat route
app.post('/api/chat2', async (req, res) => {
  try {
    const messages = [{ role: 'system', content: "You are a helpful assistant." }, ...(req.body.history || []), { role: 'user', content: req.body.input }];
    const completion = await openai.chat.completions.create({ model: CONFIGURED_MODEL, messages });
    res.json({ reply: completion.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Analyze route
app.post('/api/analyze', upload.array('files', 5), async (req, res) => {
  try {
    const content = [{ type: 'input_text', text: req.body.prompt || 'Analyze these files:' }];
    for (const f of req.files) {
      const mime = f.mimetype || lookupMime(f.originalname);
      if (mime.startsWith('image/')) {
        const b64 = f.buffer.toString('base64');
        content.push({ type: 'input_image', image_url: `data:${mime};base64,${b64}` });
      } else if (mime === 'application/pdf') {
        const text = await extractPdfText(f.buffer);
        content.push({ type: 'input_text', text: text.slice(0, 10000) });
      }
    }
    const completion = await openai.responses.create({ model: CONFIGURED_MODEL, input: [{ role: 'user', content }] });
    res.json({ reply: completion.output_text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Image generation route
app.post('/api/image', async (req, res) => {
  try {
    const { prompt } = req.body;
    const img = await openai.images.generate({ model: "gpt-image-1", prompt, size: "1024x1024" });
    res.json({ url: img.data[0].url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
