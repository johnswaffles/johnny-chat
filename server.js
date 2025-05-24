// server.js

// AT THE TOP OF YOUR server.js, with other require statements:
// const OpenAI  = require('openai'); // you already have this
// const fs      = require('fs');      // you already have this
// const sharp   = require('sharp');   // you already have this
// const pdf     = require('pdf-parse'); // you already have this
// const multer  = require('multer');  // you already have this
// const upload = multer({ dest: 'tmp/' }); // you already have this

// DEFINE THE UNIVERSAL PERSONA FOR THE BACKEND
const UNIVERSAL_CHATBOT_PERSONA_BACKEND = "You are a helpful and approachable AI assistant. You have a friendly and slightly humorous personality. Please keep your responses conversational. Do not refer to yourself by any specific name.";

// ... (your other app setup, /chat, /speech, /image endpoints) ...

/*── VISION (OpenAI - images OR PDFs, with optional user_query) ──────────────────*/
app.post('/vision', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded." });
    }
    const { path: tmp, mimetype, size } = req.file;
    const userQuery = req.body.user_query; // Get the user's question about the file

    // Common system message for the LLM
    const systemMessage = { role: 'system', content: UNIVERSAL_CHATBOT_PERSONA_BACKEND };

    if (mimetype.startsWith('image/')) {
      let buf = fs.readFileSync(tmp);
      // Consider a slightly larger resize or conditional resize based on actual vision model input limits
      // For gpt-4o, it can handle larger images well. Resizing aggressively might lose detail.
      // Max 20MB per image for GPT-4o. 900KB is very conservative. Let's keep it for now for speed.
      if (size > 900_000) { // ~0.9MB
        buf = await sharp(buf).resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true }).toBuffer();
      }
      fs.unlink(tmp, (unlinkErr) => { if (unlinkErr) console.error("Error deleting temp image file:", tmp, unlinkErr);});
      const dataURL = `data:${mimetype};base64,${buf.toString('base64')}`;
    
      const imageMessages = [
        systemMessage,
        {
          role: 'user',
          content: [
            { type: 'text', text: userQuery || 'Describe this image comprehensively.' }, // Use user's query or default
            { type: 'image_url', image_url: { url: dataURL, detail: "auto" } } // detail: "low", "high", "auto"
          ]
        }
      ];
      
      const out = await openai.chat.completions.create({
        model: 'gpt-4o-mini', // Vision-capable model
        messages: imageMessages,
        max_tokens: 500 // Adjust as needed
      });
      return res.json({ description: out.choices[0].message.content });
    }
      
    if (mimetype === 'application/pdf') {
      const data = fs.readFileSync(tmp);  
      fs.unlink(tmp, (unlinkErr) => { if (unlinkErr) console.error("Error deleting temp PDF file:", tmp, unlinkErr);});
      // Increased slice for more context, ensure your model can handle it
      // 32000 chars is roughly 8k tokens. o4-mini has a large context window.
      const text = (await pdf(data)).text.slice(0, 32000); 
      
      let pdfPromptContent;
      if (userQuery) {
        pdfPromptContent = `Please answer the following question based on the provided PDF text: "${userQuery}"\n\nPDF Text:\n---\n${text}\n---`;
      } else {
        pdfPromptContent = `Here is the extracted text from a PDF:\n\n${text}\n\nPlease summarize the document and its key points.`;
      }

      const pdfMessages = [
        systemMessage,
        {
          role:'user',
          content: pdfPromptContent
        }
      ];
      
      const out  = await openai.chat.completions.create({
        model: 'gpt-4o-mini', // Use a model good for text analysis and following instructions
        messages: pdfMessages,
        max_tokens: 500 // Adjust as needed
      });
      return res.json({ description: out.choices[0].message.content });
    }  
    
    // If file type is not image or PDF
    fs.unlink(tmp, (unlinkErr) => { if (unlinkErr) console.error("Error deleting temp unsupported file:", tmp, unlinkErr);});
    res.status(415).json({ error: "Unsupported file type (image or PDF only)" });
      
  } catch (err) {
    console.error("Vision error:", err);
    // Ensure temp file is deleted even if an error occurs mid-processing
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        fs.unlink(req.file.path, (unlinkErr) => { if (unlinkErr) console.error("Error deleting temp file on vision error:", req.file.path, unlinkErr);});
    }
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

// ... (your PORT listener and other routes) ...
