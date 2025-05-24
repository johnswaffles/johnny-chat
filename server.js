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

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const app = express();
const upload = multer({ dest: 'tmp/' });

const UNIVERSAL_CHATBOT_PERSONA_BACKEND = "You are a helpful and approachable AI assistant. You have a friendly and slightly humorous personality. Please keep your responses conversational. Do not refer to yourself by any specific name.";

app.use(cors());
app.use(express.json());

/*── CHAT (OpenAI) ────────────────────────────────────────────*/
app.post('/chat', async (req, res) => {
  try {
    const model = req.body.model || 'gpt-4.1-nano'; 
    const messages = req.body.messages;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        console.error("Chat Error: Bad request - messages missing or not an array.");
        return res.status(400).json({ error: "Messages are required and must be an array." });
    }
    
    let finalMessages = [...messages];
    if (finalMessages.length > 0 && finalMessages[0].role !== 'system') {
        finalMessages.unshift({ role: 'system', content: UNIVERSAL_CHATBOT_PERSONA_BACKEND });
    } else if (finalMessages.length === 0) {
         finalMessages.push({ role: 'system', content: UNIVERSAL_CHATBOT_PERSONA_BACKEND });
         // Add a dummy user message if only system message, though frontend should prevent this
         finalMessages.push({ role: 'user', content: "Hello" });
    }


    console.log(`Chat request to model: ${model} with messages count: ${finalMessages.length}`);
    // console.log(`Chat request messages:`, JSON.stringify(finalMessages, null, 2));


    const out = await openai.chat.completions.create({
      model,
      messages: finalMessages
    });

    if (!out.choices || out.choices.length === 0 || !out.choices[0].message) {
        console.error("Chat Error: OpenAI response missing choices or message.", JSON.stringify(out, null, 2));
        return res.status(500).json({ error: "Invalid response structure from OpenAI for chat." });
    }
    
    console.log("Chat success. OpenAI response choice:", JSON.stringify(out.choices[0], null, 2));
    res.json(out.choices[0].message);

  } catch (err) {
    console.error('Chat API Error Full:', err);
    let errorMsg = "An unexpected error occurred in chat.";
    let statusCode = 500;
    if (err.response) { 
        errorMsg = err.response.data?.error?.message || err.message || "OpenAI API error";
        statusCode = err.response.status || 500;
        console.error('OpenAI Error Response (Chat):', { status: statusCode, data: err.response.data });
    } else if (err.status) { 
        errorMsg = err.error?.message || err.message || "OpenAI API processing error";
        statusCode = err.status;
         console.error('OpenAI SDK Error (Chat):', { status: statusCode, error: err.error });
    } else {
        errorMsg = err.message || errorMsg;
    }
    res.status(statusCode).json({ error: errorMsg });
  }
});

/*── TTS (OpenAI) ─────────────────────────────────────────────*/
app.post('/speech', async (req, res) => {
  const textToSpeak = req.body.text;
  const selectedVoice = req.body.voice || 'shimmer';
  if (!textToSpeak) return res.status(400).json({ error: 'No text provided.' });
  try {
    const audio = await openai.audio.speech.create({ model: 'gpt-4o-mini-tts', voice: selectedVoice, input: textToSpeak, response_format: 'mp3' });
    res.set('Content-Type', 'audio/mpeg');
    res.send(Buffer.from(await audio.arrayBuffer()));
  } catch (err) {
    console.error('TTS API Error Full:', err);
    let errorMsg = "An unexpected error occurred in TTS.";
    let statusCode = 500;
    if (err.response) { errorMsg = err.response.data?.error?.message || err.message; statusCode = err.response.status || 500; } 
    else if (err.status) { errorMsg = err.error?.message || err.message; statusCode = err.status; }
    else { errorMsg = err.message || errorMsg; }
    res.status(statusCode).json({ error: errorMsg });
  }
});

/*── IMAGE  (GPT-Image-1) ─────────────────────────────────────*/
app.post("/image", async (req, res) => {
  try {
    const img = await openai.images.generate({
      model:  "gpt-image-1",
      prompt: req.body.prompt,
      size:   "1024x1024",
      n:      1                    // <-- NO response_format here
    });
    // gpt-image-1 always returns base-64 PNG in data[0].b64_json
    res.json({ image: img.data[0].b64_json });
  } catch (err) {
    console.error("Image error:", err);
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

/*── VISION (OpenAI) ──────────────────*/
app.post('/vision', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded." });
    const { path: tmp, mimetype, size } = req.file;
    const userQuery = req.body.user_query;
    const systemMessage = { role: 'system', content: UNIVERSAL_CHATBOT_PERSONA_BACKEND };
    let visionMessages = [systemMessage];
    let modelToUse = 'gpt-4.1-nano';

    if (mimetype.startsWith('image/')) {
      let buf = fs.readFileSync(tmp);
      if (size > 2_000_000) buf = await sharp(buf).resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true }).toBuffer();
      fs.unlink(tmp, (e) => { if (e) console.error("Error deleting tmp image:", tmp, e);});
      const dataURL = `data:${mimetype};base64,${buf.toString('base64')}`;
      visionMessages.push({ role: 'user', content: [{ type: 'text', text: userQuery || 'Describe this image comprehensively.' }, { type: 'image_url', image_url: { url: dataURL, detail: "auto" } }] });
    } else if (mimetype === 'application/pdf') {
      const data = fs.readFileSync(tmp);  
      fs.unlink(tmp, (e) => { if (e) console.error("Error deleting tmp PDF:", tmp, e);});
      const text = (await pdf(data)).text.slice(0, 80000);
      const pdfPrompt = userQuery ? `Answer this question: "${userQuery}" based on the PDF text: \n---\n${text}\n---` : `Summarize this PDF text: \n---\n${text}\n---`;
      visionMessages.push({ role: 'user', content: pdfPrompt });
    } else {
      fs.unlink(tmp, (e) => { if (e) console.error("Error deleting tmp unsupported:", tmp, e);});
      return res.status(415).json({ error: "Unsupported file type." });
    }

    console.log(`Vision request to model: ${modelToUse} with query: "${userQuery || (mimetype.startsWith('image/') ? 'Describe image' : 'Summarize PDF')}"`);

    const out = await openai.chat.completions.create({ model: modelToUse, messages: visionMessages, max_tokens: 700 });
    if (!out.choices || out.choices.length === 0 || !out.choices[0].message) {
        console.error("Vision Error: OpenAI response missing choices or message.", JSON.stringify(out, null, 2));
        return res.status(500).json({ error: "Invalid response structure from OpenAI for vision." });
    }
    console.log("Vision success. OpenAI response choice:", JSON.stringify(out.choices[0], null, 2));
    res.json({ description: out.choices[0].message.content });
      
  } catch (err) {
    console.error("Vision API Error Full:", err);
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        fs.unlink(req.file.path, (unlinkErr) => { if (unlinkErr) console.error("Error deleting temp file on vision error:", req.file.path, unlinkErr);});
    }
    let errorMsg = "An unexpected error occurred in vision processing.";
    let statusCode = 500;
    if (err.response) { errorMsg = err.response.data?.error?.message || err.message; statusCode = err.response.status || 500;} 
    else if (err.status) { errorMsg = err.error?.message || err.message; statusCode = err.status; }
    else { errorMsg = err.message || errorMsg; }
    res.status(statusCode).json({ error: errorMsg });
  }
});

/*── SEARCH (OpenAI) ────────*/
app.post('/search', async (req, res) => {
  const userQuery = req.body.query;
  if (!userQuery) return res.status(400).json({ error: 'No query provided.' });
  try {
    const searchMessages = [
        {role: "system", content: `${UNIVERSAL_CHATBOT_PERSONA_BACKEND} You can access web information. Answer based on current data.`},
        {role: "user", content: `Search the web for: "${userQuery}"`}
    ];
    console.log(`Search request to model: gpt-4.1-nano with query: "${userQuery}"`);
    const out = await openai.chat.completions.create({ model: 'gpt-4.1-nano', messages: searchMessages, max_tokens: 500 });
     if (!out.choices || out.choices.length === 0 || !out.choices[0].message) {
        console.error("Search Error: OpenAI response missing choices or message.", JSON.stringify(out, null, 2));
        return res.status(500).json({ error: "Invalid response structure from OpenAI for search." });
    }
    console.log("Search success. OpenAI response choice:", JSON.stringify(out.choices[0], null, 2));
    res.json({ result: out.choices[0].message.content });
  } catch (err) {
    console.error('Search API Error Full:', err);
    let errorMsg = "An unexpected error occurred during search.";
    let statusCode = 500;
    if (err.response) { errorMsg = err.response.data?.error?.message || err.message; statusCode = err.response.status || 500; } 
    else if (err.status) { errorMsg = err.error?.message || err.message; statusCode = err.status; }
    else { errorMsg = err.message || errorMsg; }
    res.status(statusCode).json({ error: errorMsg });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log(`API running on http://localhost:${PORT}`));
