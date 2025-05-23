/*──────────────────────────────────────────────────────────────
  server.js
  • Chat  :  o4-mini (OpenAI)
  • TTS   :  Gemini TTS (Google GenAI) "Sadaltager"
  • Image :  GPT-Image-1 (OpenAI - base64)
  • Vision:  GPT-4o-mini (OpenAI - images/PDFs)
  • Search:  gpt-4.1-mini with web_search_preview (OpenAI)
──────────────────────────────────────────────────────────────*/

require('dotenv').config();
const OpenAI  = require('openai');
const express = require('express');
const cors    = require('cors');
const multer  = require('multer');
const fs      = require('fs');
const sharp   = require('sharp');
const pdf     = require('pdf-parse');

// NEW: Import GoogleGenerativeAI
const { GoogleGenerativeAI } = require("@google/generative-ai");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const app    = express();
const upload = multer({ dest: 'tmp/' });

app.use(cors());
app.use(express.json());

/*── CHAT (OpenAI) ────────────────────────────────────────────*/
app.post('/chat', async (req, res) => {
  try {
    const model = req.body.model || 'o4-mini';
    const out = await openai.chat.completions.create({
      model,
      messages: req.body.messages
    });
    res.json(out.choices[0].message);
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: err.message });
  }
});

/*───────────────────────────────────────────────────────────────┐
| HELPER FUNCTIONS FOR GEMINI TTS (Derived from Python example)   |
└───────────────────────────────────────────────────────────────*/
function parseAudioMimeType(mimeType) {
    let bitsPerSample = 16; // Default
    let rate = 24000;       // Default

    const parts = mimeType.split(';');
    for (const param of parts) {
        const trimmedParam = param.trim().toLowerCase();
        if (trimmedParam.startsWith("rate=")) {
            try {
                const rateStr = trimmedParam.split("=")[1];
                if (rateStr) rate = parseInt(rateStr, 10);
            } catch (e) { /* ignore, use default */ }
        } else if (trimmedParam.startsWith("audio/l")) { // e.g., audio/L16
            try {
                const bpsStr = trimmedParam.substring(trimmedParam.indexOf('l') + 1);
                if (bpsStr) bitsPerSample = parseInt(bpsStr, 10);
            } catch (e) { /* ignore, use default */ }
        }
    }
    return { bits_per_sample: bitsPerSample, rate: rate };
}

function convertToWav(audioDataBuffer, mimeType) { // audioDataBuffer is a Node.js Buffer
    const params = parseAudioMimeType(mimeType);
    const bitsPerSample = params.bits_per_sample;
    const sampleRate = params.rate;
    const numChannels = 1;

    const dataSize = audioDataBuffer.length;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const headerSize = 44;
    const chunkSize = (headerSize - 8) + dataSize;

    const header = Buffer.alloc(headerSize);
    header.write('RIFF', 0);
    header.writeUInt32LE(chunkSize, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);
    return Buffer.concat([header, audioDataBuffer]);
}

/*── TTS (Google GenAI) ───────────────────────────────────────*/
app.post('/speech', async (req, res) => {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
      console.error('Gemini TTS error: GEMINI_API_KEY is not set.');
      return res.status(500).json({ error: "Server configuration error: GEMINI_API_KEY is not set." });
  }

  const textToSpeak = req.body.text;
  if (!textToSpeak) {
      return res.status(400).json({ error: "Missing text in request body" });
  }

  try {
      const genAI = new GoogleGenerativeAI(geminiApiKey);
      const modelName = "gemini-2.5-flash-preview-tts";

      const generationAndSpeechConfig = {
          temperature: 1.0,
          response_modalities: ["audio"],
          speech_config: {
              voice_config: {
                  prebuilt_voice_config: {
                      voice_name: "Sadaltager"
                  }
              }
          }
      };

      const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: generationAndSpeechConfig
      });

      const contents = [{
          role: "user",
          parts: [{ text: textToSpeak }],
      }];

      const result = await model.generateContentStream({ contents });

      let audioBuffer = Buffer.alloc(0);
      let audioMimeType = null;

      for await (const chunk of result.stream) {
          if (chunk.candidates && chunk.candidates[0].content && chunk.candidates[0].content.parts) {
              const part = chunk.candidates[0].content.parts[0];
              if (part.inlineData) {
                  if (!audioMimeType) {
                      audioMimeType = part.inlineData.mimeType;
                      console.log("Gemini TTS: Received first audio chunk. MIME type:", audioMimeType);
                  }
                  const chunkData = Buffer.from(part.inlineData.data, 'base64');
                  audioBuffer = Buffer.concat([audioBuffer, chunkData]);
              } else if (part.text && audioBuffer.length === 0) {
                  console.warn("Gemini TTS: Received text part before/instead of audio:", part.text);
              }
          }
      }
      
      if (audioBuffer.length === 0) {
          let textualResponse = "";
          try {
              const fullResponse = await result.response;
              if (fullResponse && fullResponse.candidates && fullResponse.candidates[0].content && fullResponse.candidates[0].content.parts) {
                  fullResponse.candidates[0].content.parts.forEach(p => { if (p.text) textualResponse += p.text + " "; });
              }
          } catch (aggError) { console.error("Gemini TTS: Error aggregating full response after no audio:", aggError); }
          throw new Error(textualResponse.trim() ? `No audio data. Gemini's text: ${textualResponse.trim()}` : "No audio data received.");
      }

      if (!audioMimeType) throw new Error("Audio data received, but MIME type unknown.");

      let finalAudioBuffer = audioBuffer;
      let finalMimeType = audioMimeType;

      if (audioMimeType.toLowerCase().startsWith('audio/l')) {
          console.log(`Gemini TTS: Original MIME type ${audioMimeType} suggests raw PCM. Converting to WAV.`);
          finalAudioBuffer = convertToWav(audioBuffer, audioMimeType);
          finalMimeType = 'audio/wav';
      }

      console.log(`Gemini TTS: Sending audio with MIME type: ${finalMimeType}, size: ${finalAudioBuffer.length} bytes`);
      res.set('Content-Type', finalMimeType);
      res.send(finalAudioBuffer);

  } catch (err) {
      console.error('Gemini TTS error details:', err);
      let errorMessage = err.message || "Unknown TTS error";
      if (err.toString && err.toString().includes('GoogleGenerativeAIError')) {
         errorMessage = `Google GenAI API Error: ${err.message}`;
         if(err.statusInfo) errorMessage += ` Details: ${JSON.stringify(err.statusInfo)}`;
      }
      res.status(500).json({ error: `Gemini TTS Error: ${errorMessage}` });
  }
});

/*── IMAGE (OpenAI GPT-Image-1) ────────────────────────────────*/
app.post("/image", async (req, res) => {
  try {
    const img = await openai.images.generate({
      model:  "gpt-image-1", // Using gpt-image-1
      prompt: req.body.prompt,
      size:   "1024x1024",
      n:      1               // No response_format needed for gpt-image-1 when expecting b64_json
    });
    // gpt-image-1 usually returns base-64 PNG in data[0].b64_json by default for this SDK version
    // Ensure your SDK version and the API behave as expected.
    // If not, you might need to specify response_format: 'b64_json' explicitly
    // if the default changes in future OpenAI SDK versions or for this model.
    res.json({ image: img.data[0].b64_json });
  } catch (err) {
    console.error("Image error:", err); 
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

/*── VISION (OpenAI - images OR PDFs) ─────────────────────────*/
app.post('/vision', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded." });
    }
    const { path: tmp, mimetype, size } = req.file;

    if (mimetype.startsWith('image/')) {
      let buf = fs.readFileSync(tmp);
      if (size > 900_000) buf = await sharp(buf).resize({ width: 640 }).toBuffer();
      fs.unlink(tmp, (unlinkErr) => { if (unlinkErr) console.error("Error deleting temp image file:", unlinkErr);});
      const dataURL = `data:${mimetype};base64,${buf.toString('base64')}`;

      const out = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: [
            { type: 'text',      text: 'Describe this image.' },
            { type: 'image_url', image_url: { url: dataURL } }
          ]
        }]
      });
      return res.json({ description: out.choices[0].message.content });
    }

    if (mimetype === 'application/pdf') {
      const data = fs.readFileSync(tmp);
      fs.unlink(tmp, (unlinkErr) => { if (unlinkErr) console.error("Error deleting temp PDF file:", unlinkErr);});
      const text = (await pdf(data)).text.slice(0, 8000);
      const out  = await openai.chat.completions.create({
        model: 'o4-mini',
        messages: [{
          role:'user',
          content:`Here is the extracted text from a PDF:\n\n${text}\n\nPlease summarize the document.`
        }]
      });
      return res.json({ description: out.choices[0].message.content });
    }
        
    fs.unlink(tmp, (unlinkErr) => { if (unlinkErr) console.error("Error deleting temp unsupported file:", unlinkErr);});
    res.status(415).json({ error: "Unsupported file type (image or PDF only)" });
            
  } catch (err) {
    console.error("Vision error:", err);
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        fs.unlink(req.file.path, (unlinkErr) => { if (unlinkErr) console.error("Error deleting temp file on vision error:", unlinkErr);});
    }
    res.status(err.status ?? 500).json({ error: err.message });
  }
});
     
/*── WEB SEARCH (OpenAI - preview tool) ───────────────────────*/
app.post("/search", async (req, res) => {
  try {
    const out = await openai.responses.create({ // This uses openai.responses.create
      model: "gpt-4.1-mini",
      tools: [{ type: "web_search_preview" }],
      input: req.body.query
    });
    res.json({ answer: out.output_text });
  } catch (err) {
    console.error("Search error:", err);
    res.status(err.status ?? 500).json({ error: err.message });
  }
});  
        
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`API ready  →  http://localhost:${PORT}`));
