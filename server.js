// server.js – Johnny-Chat (clean refresh)
// --------------------------------------

import 'dotenv/config';          // loads OPENAI_API_KEY, TEXT_MODEL, IMAGE_MODEL, etc.
import express from 'express';
import cors    from 'cors';

import chatRouter from './routes/chat.js';

const app  = express();
const PORT = process.env.PORT || 10000;

/* ---------- middleware ---------- */
app.use(cors());                           // enable CORS for Squarespace front-end
app.use(express.json({ limit: '10mb' }));  // large enough for base64 images

/* ---------- routes --------------- */
app.use('/api', chatRouter);               // POST /api/chat , /api/image , /api/vision

/* ---------- start ---------------- */
app.listen(PORT, () => {
  console.log(`✅  Server running on port ${PORT}`);
});
