/*──────────────────────────────────────────────────────────────
  Story-bot API
  ─ /chat     : generate the next story paragraph (GPT-4o-mini)
  ─ /speech   : MP3 narration of any text (gpt-4o-mini-tts)
  ─ /image    : GPT-Image-1 illustration, with character-lock
──────────────────────────────────────────────────────────────*/
require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const { OpenAI } = require("openai");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const app    = express();
app.use(cors());
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ limit: '12mb', extended: true }));

/*── CHAT ─────────────────────────────────────────────────────*/
app.post("/chat", async (req, res) => {
  try {
    const out = await openai.chat.completions.create({
      model:        "gpt-4.1-nano",
      temperature:  0.85,
      messages:     req.body.messages
    });
    res.json({ content: out.choices[0].message.content });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: err.message });
  }
});

/*── IMAGE (GPT-Image-1) ──────────────────────────────────────*/
const sessions = new Map();                // {sessionId → lastImageId}

/*
  body = {
    sessionId : "<uuid from browser>",
    prompt    : "<paragraph text>",
    style     : "<art-style string>"
  }
*/
app.post("/image", async (req, res) => {
  try {
    const { sessionId, prompt, style = "" } = req.body;

    const previous = sessions.get(sessionId) || null; // image-id for consistency

    const result = await openai.images.generate({
      model: "gpt-image-1",
      prompt: `Illustration (${style}). ${prompt}`,
      ...(previous && { previous_response_id: previous }),
      size:  "1024x1024",
      n:     1
    });

    const img = result.data[0];
    sessions.set(sessionId, img.id);        // remember for next turn
    res.json({ b64: img.b64_json });

  } catch (err) {
    console.error("Image error:", err);
    res.status(500).json({ error: err.message });
  }
});

/*── TTS ──────────────────────────────────────────────────────*/
app.post("/speech", async (req, res) => {
  try {
    const mp3 = await openai.audio.speech.create({
      model:   "gpt-4o-mini-tts",
      voice:   req.body.voice || "onyx",
      input:   req.body.text,
      format:  "mp3",
      instructions:"Narrate clearly and engagingly"
    });
    const buf = Buffer.from(await mp3.arrayBuffer());
    res.set("Content-Type","audio/mpeg");
    res.send(buf);
  } catch (err) {
    console.error("TTS error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ----- In your server.js --------
// Ensure you have these at the top of your file or relevant scope
const express = require('express'); 
const multer = require('multer');
const OpenAI = require('openai'); // Assuming you're using the official 'openai' Node.js library

// const app = express(); // Or your existing Express app instance
// const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY }); // Initialize OpenAI client

/* ────────────────────────────────────────────────
   VISION  – analyse / describe an image or PDF
   POST  /vision
   ─────────────────────────────────────────────── */
    
const visionUpload = multer({ // Renamed to avoid conflict if 'upload' is used elsewhere
  limits: { fileSize: 12 * 1024 * 1024 },      // 12 MB hard cap for form-data uploads
  fileFilter: (req, file, cb) => {
    // Accept common image types and PDFs
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
        cb(null, true); // Accept file
    } else {
        // Reject file with a specific error message
        cb(new Error('INVALID_MIME_TYPE: Only images (PNG, JPG, GIF, WEBP) and PDF files are supported.'), false);
    }
  }
});
    
app.post('/vision', visionUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) { // Should be caught by multer if file is mandatory, but good check
        return res.status(400).json({ error: 'No file was uploaded.' });
    }

    /* -------- 1.  Normalise the incoming file (image or PDF) ---------------- */
    let { imageUrl, imageB64, question = 'Describe this item in detail. If it is a document, please summarize its content.' } = req.body || {};

    // If a file was uploaded, convert it to a data URI
    // This part correctly handles any file buffer multer provides, including PDFs
    if (req.file) {
      const mime = req.file.mimetype; // Mime type from multer (e.g., 'application/pdf')
      const base64 = req.file.buffer.toString('base64');
      imageB64 = `data:${mime};base64,${base64}`; // Correctly forms data URI for PDF or image
    }
      
    // Basic validation (though file upload is primary path here)
    if (!imageUrl && !imageB64) {
      return res.status(400).json({ error: 'No file data available to process (missing imageUrl, imageB64, or uploaded file).' });
    }
    
    // Content block for OpenAI API
    const itemContent = {
      type: 'image_url', // This type is used for both images and file data URIs like PDF for compatible models
      image_url: { 
        url: imageUrl ? imageUrl.trim() : imageB64.trim()
        // For PDFs with gpt-4o or gpt-4-turbo (vision), 'detail' is usually not needed or defaults to 'auto'
      }
    };
      
    /* -------- 2.  Call compatible GPT model with the item ------------- */
    const messages = [
      {
        role: 'user',
        content: [
          { type: 'text', text: question },
          itemContent   
        ]
      }
    ];

    // Ensure you're using a model that explicitly supports PDF processing via data URIs
    // 'gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo' (formerly gpt-4-vision-preview) are good candidates.
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', 
      messages,
      max_tokens: 768 // May need more tokens for detailed summaries of dense PDFs
    });
    
    const answer = completion.choices?.[0]?.message?.content?.trim() || '(The AI did not provide a description or summary.)';
    res.json({ content: answer });
      
  } catch (err) {
    // Log the actual error on your server – THIS IS CRITICAL FOR DEBUGGING 500s
    console.error('Error in /vision endpoint:', err.message, err.stack, err.response?.data);

    // Check for custom error from multer fileFilter
    if (err.message && err.message.startsWith('INVALID_MIME_TYPE')) {
        return res.status(400).json({ error: err.message });
    }
    // Check for multer's built-in error codes (e.g., from limits)
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File larger than 12 MB – please upload a smaller file.' });
    }
    
    // Handle potential errors from the OpenAI API more specifically
    if (err.response && err.response.data && err.response.data.error) {
        console.error('OpenAI API Error details:', err.response.data.error);
        return res.status(err.response.status || 500).json({ error: `AI Error: ${err.response.data.error.message}` });
    }

    // General fallback for other internal server errors
    res.status(500).json({ error: err.message || 'An internal error occurred in the vision service.' });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, ()=>console.log(`API → http://localhost:${PORT}`));

