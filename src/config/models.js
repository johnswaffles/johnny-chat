export const MODELS = {
  "gpt-4.1-nano": {
    tools: [],
    inputCost: 0.15,
    outputCost: 0.20
  },
  "gpt-4o-mini-search-preview": {
    tools: ["web_search"],
    inputCost: 1.0,
    outputCost: 2.0
  },
  "gpt-4-image-1-medium": {
    tools: ["image_generation"],
    raw: true
  },
  "gpt-4o": {
    tools: ["web_search", "image_generation", "vision"],
    inputCost: 10,
    outputCost: 30
  }
};
