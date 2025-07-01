// server.js – Express entry-point for Just Ask Johnny back-end
// -----------------------------------------------------------
// 2025-07-01  — clean rebuild
//   • Uses ESM ("type":"module" in package.json)
//   • dotenv/config autoloads env vars before anything else
//   • CORS locked down via ALLOWED_ORIGIN env (fallback ➜ "*")
//   • Exposes /api/chat (text + web_search), /api/upload (vision)
//   • Ready for Render, Railway, Fly, Heroku, etc.

import 'dotenv/config';                  // loads .env → process.env
import express from 'express';
import cors from 'cors';
import multer from 'multer';

import chatRouter from './routes/chat.js';

// ---------------------------------------------------------------------------
// Basic app + middleware
// ---------------------------------------------------------------------------
const app  = express();
const PORT = process.env.PORT || 10000;

// CORS — comma-separated list in env (e.g. "https://foo.com,https://bar.com")
app.use(cors({
  origin: (process.env.ALLOWED_ORIGIN ?? '*').split(',').map(s => s.trim())
}));

// JSON bodies up to 10 MB (enough for base64 screen-caps, etc.)
app.use(express.json({ limit: '10mb' }));

// ---------------------------------------------------------------------------
// Optional FILE upload endpoint — used by the front-end to send images for GPT 4-vision.
// Multer puts the file into memory so we can forward the Buffer directly to OpenAI.
// ---------------------------------------------------------------------------
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // 10 MB

app.post('/api/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image received.' });

    // Return base64 string (front-end posts this back as input_image → gpt-4-vision)
    const base64 = req.file.buffer.toString('base64');
    res.json({ filename: req.file.originalname, mime: req.file.mimetype, base64 });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Internal upload error' });
  }
});

// ---------------------------------------------------------------------------
// Core chat route (text + web_search + image_generation)
// ---------------------------------------------------------------------------
app.use('/api', chatRouter); // →  /api/chat

// Health-check
app.get('/', (_, res) => res.send('🟢 Just Ask Johnny back-end up & running'));

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`⚡️ Johnny-Chat server listening on port ${PORT}`);
});

