/* -------- Stage 1 : search-preview with custom style -------- */

const stylePrompt = {
  role: "system",
  content: `
Write engaging, paragraph-style text with a touch of intelligent humor.
Guidelines:
• Keep humor subtle, do not overpower facts.
• Use coherent paragraphs, no bullet lists.
• Convert bare URLs to “(See: …)” parentheticals.
`
};

const first = await openai.chat.completions.create({
  model   : "gpt-4o-mini-search-preview",
  messages: [stylePrompt, ...history],   //  ← prepend here
  max_tokens: 1900
});

