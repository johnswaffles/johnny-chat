/*── VISION (images OR PDFs) ─────────────────────────────────────────*/
app.post('/vision', upload.single('file'), async (req, res) => {
  try {
    const { path: tmp, mimetype, size } = req.file;
    const buf = fs.readFileSync(tmp);
    fs.unlinkSync(tmp);

    // For images: send to responses.create
    if (mimetype.startsWith('image/')) {
      const dataURL = `data:${mimetype};base64,${buf.toString('base64')}`;
      const out = await openai.responses.create({
        model: 'gpt-4.1-mini',      // or your preferred Vision model
        input: [{
          role: 'user',
          content: [
            { type: 'input_text',  text: 'Describe this image.' },
            { type: 'input_image', image_url: dataURL }
          ]
        }]
      });
      return res.json({ description: out.output_text });
    }

    // For PDFs: fall back to pdf-parse, then chat
    if (mimetype === 'application/pdf') {
      const text = (await pdf(buf)).text.slice(0, 8000);
      const out = await openai.chat.completions.create({
        model: 'o4-mini',
        messages: [{
          role: 'user',
          content: `Here is the extracted text from a PDF:\n\n${text}\n\nPlease summarize the document.`
        }]
      });
      return res.json({ description: out.choices[0].message.content });
    }

    res.status(415).json({ error: 'Unsupported file type' });
  } catch (err) {
    console.error('Vision error:', err);
    res.status(500).json({ error: err.message });
  }
});

