import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

const PORT = process.env.PORT || 3000;
const MODEL = process.env.CHAT_MODEL || 'gpt-5-mini';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const app = express();

// Allow your site + localhost
app.use(cors({
  origin: [
    'https://justaskjohnny.com',
    'https://www.justaskjohnny.com',
    'http://localhost:3000'
  ]
}));

app.use(express.json());

// Chat endpoint
app.post(['/chat', '/api/chat'], async (req, res) => {
  let messages = [];

  // If full history provided
  if (Array.isArray(req.body.history)) {
    messages = req.body.history;
  } else if (Array.isArray(req.body.messages)) {
    messages = req.body.messages;
  }

  // If only "input" string provided, wrap it
  if (req.body.input && (!messages.length || messages[messages.length - 1]?.content !== req.body.input)) {
    messages.push({ role: 'user', content: req.body.input });
  }

  if (!messages.length) {
    return res.status(400).json({ error: 'No input or message history provided' });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages,
      temperature: 0.7
    });

    const reply = completion.choices?.[0]?.message?.content || '';
    res.json({ reply });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Chat request failed' });
  }
});

// Health check
app.get(['/health', '/api/health'], (_req, res) => {
  res.json({ status: 'ok', model: MODEL });
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT} using model: ${MODEL}`);
