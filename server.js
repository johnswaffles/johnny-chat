/*──────────────────────────────────────────────────────────────
  server.js
  • Chat  :  gpt-4.1-nano (OpenAI) - Default
  • TTS   :  gpt-4o-mini-tts (OpenAI) - Selectable voice
  • Image :  DALL·E 3 (OpenAI - b64_json)
  • Vision:  gpt-4.1-nano (OpenAI - images/PDFs with user_query)
  • Search:  gpt-4.1-nano (OpenAI - simulated tool call for web search)
──────────────────────────────────────────────────────────────*/

require('dotenv').config();
const OpenAI  = require('openai');
const express = require('express');
const cors    = require('cors');
const multer  = require('multer');
const fs      = require('fs');
const sharp   = require('sharp');
const pdf     = require('pdf-parse');

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Initialize Express App
const app = express();

// Initialize Multer
const upload = multer({ dest: 'tmp/' });

// Define UNIVERSAL_CHATBOT_PERSONA_BACKEND
const UNIVERSAL_CHATBOT_PERSONA_BACKEND = "You are a helpful and approachable AI assistant. You have a friendly and slightly humorous personality. Please keep your responses conversational. Do not refer to yourself by any specific name.";

// Apply middleware
app.use(cors());
app.use(express.json());

/*── CHAT (OpenAI) ────────────────────────────────────────────*/
app.post('/chat', async (req, res) => {
  try {
    // Use model from request body, or default to 'gpt-4.1-nano'
    const model = req.body.model || 'gpt-4.1-nano'; 
    const messages = req.body.messages;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "Messages are required and must be an array." });
    }
    
    let finalMessages = [...messages];
    if (finalMessages.length === 0 || finalMessages[0].role !== 'system' || !finalMessages[0].content.includes("You are a helpful and approachable AI assistant")) {
        finalMessages.unshift({ role: 'system', content: UNIVERSAL_CHATBOT_PERSONA_BACKEND });
    }

    const out = await openai.chat.completions.create({
      model, // Uses 'gpt-4.1-nano' if not specified by client
      messages: finalMessages
    });
    res.json(out.choices[0].message);
  } catch (err) {
    console.error('Chat error:', err);
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

/*── TTS (OpenAI) ─────────────────────────────────────────────*/
app.post('/speech', async (req, res) => {
  const textToSpeak = req.body.text;
  const selectedVoice = req.body.voice || 'shimmer';

  if (!textToSpeak) {
    return res.status(400).json({ error: 'No text provided for speech synthesis.' });
  }

  try {
    const audio = await openai.audio.speech.create({
      model:  'gpt-4o-mini-tts', // TTS model remains specialized
      voice:  selectedVoice,
      input:  textToSpeak,
      response_format: 'mp3'
    });
    res.set('Content-Type', 'audio/mpeg');
    const audioBuffer = Buffer.from(await audio.arrayBuffer());
    res.send(audioBuffer);
  } catch (err) {
    console.error('TTS error:', err);
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

/*── IMAGE (DALL·E 3) ───────────────────────────────────────*/
app.post('/image', async (req, res) => {
  try {
    const prompt = req.body.prompt;
    if (!prompt) {
        return res.status(400).json({ error: "Prompt is required for image generation." });
    }
    const img = await openai.images.generate({
      model:  'dall-e-3', // Image generation model remains specialized
      prompt: prompt,
      size:   '1024x1024',
      quality: 'standard',
      style:  'natural',
      n:      1,
      response_format: 'b64_json'
    });
    res.json({ image: img.data[0].b64_json });
  } catch (err) {
    console.error('Image error:', err.name, err.message);
    if (err.response) { console.error('Error response data:', err.response.data); }
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

/*── VISION (OpenAI - images OR PDFs, with optional user_query) ──────────────────*/
app.post('/vision', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded." });
    }
    const { path: tmp, mimetype, size } = req.file;
    const userQuery = req.body.user_query;

    const systemMessage = { role: 'system', content: UNIVERSAL_CHATBOT_PERSONA_BACKEND };

    if (mimetype.startsWith('image/')) {
      let buf = fs.readFileSync(tmp);
      if (size > 2_000_000) { 
        buf = await sharp(buf).resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true }).toBuffer();
      }
      fs.unlink(tmp, (unlinkErr) => { if (unlinkErr) console.error("Error deleting temp image file:", tmp, unlinkErr);});
      const dataURL = `data:${mimetype};base64,${buf.toString('base64')}`;
    
      const imageMessages = [
        systemMessage,
        {
          role: 'user',
          content: [
            { type: 'text', text: userQuery || 'Describe this image comprehensively, highlighting key elements and any text visible.' },
            { type: 'image_url', image_url: { url: dataURL, detail: "auto" } }
          ]
        }
      ];
      
      const out = await openai.chat.completions.create({
        model: 'gpt-4.1-nano', // Using gpt-4.1-nano for vision
        messages: imageMessages,
        max_tokens: 700 
      });
      return res.json({ description: out.choices[0].message.content });
    }
      
    if (mimetype === 'application/pdf') {
      const data = fs.readFileSync(tmp);  
      fs.unlink(tmp, (unlinkErr) => { if (unlinkErr) console.error("Error deleting temp PDF file:", tmp, unlinkErr);});
      const text = (await pdf(data)).text.slice(0, 80000); 
      
      let pdfPromptContent;
      if (userQuery) {
        pdfPromptContent = `Based on the following text extracted from a PDF, please answer this question: "${userQuery}"\n\nPDF Text:\n---\n${text}\n---`;
      } else {
        pdfPromptContent = `Here is the extracted text from a PDF:\n\n${text}\n\nPlease provide a concise summary of the document and list its key points.`;
      }

      const pdfMessages = [
        systemMessage,
        {
          role:'user',
          content: pdfPromptContent
        }
      ];
      
      const out  = await openai.chat.completions.create({
        model: 'gpt-4.1-nano', // Using gpt-4.1-nano for PDF processing
        messages: pdfMessages,
        max_tokens: 700 
      });
      return res.json({ description: out.choices[0].message.content });
    }  
    
    fs.unlink(tmp, (unlinkErr) => { if (unlinkErr) console.error("Error deleting temp unsupported file:", tmp, unlinkErr);});
    res.status(415).json({ error: "Unsupported file type (image or PDF only)" });
      
  } catch (err) {
    console.error("Vision error:", err);
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        fs.unlink(req.file.path, (unlinkErr) => { if (unlinkErr) console.error("Error deleting temp file on vision error:", req.file.path, unlinkErr);});
    }
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

/*── SEARCH (OpenAI - simulated web search via prompt) ────────*/
app.post('/search', async (req, res) => {
  const userQuery = req.body.query;
  if (!userQuery) {
    return res.status(400).json({ error: 'No query provided for search.' });
  }
  try {
    const searchMessages = [
        {role: "system", content: `${UNIVERSAL_CHATBOT_PERSONA_BACKEND} You have the ability to access and summarize information from the web to answer user queries. Provide a comprehensive answer based on current information.`},
        {role: "user", content: `Please search the web and provide information about: "${userQuery}"`}
    ];

    const out = await openai.chat.completions.create({
      model: 'gpt-4.1-nano', // Using gpt-4.1-nano for search simulation
      messages: searchMessages,
      max_tokens: 500
    });
    res.json({ result: out.choices[0].message.content });

  } catch (err) {
    console.error('Search error:', err);
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log(`API running on http://localhost:${PORT}`));
