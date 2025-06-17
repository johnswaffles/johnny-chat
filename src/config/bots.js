export const BOTS = {
  story: {
    system: "You are a branching narrative AI. Speak in second person. Every user choice should be offered as numbered options.",
    defaultModel: "gpt-4.1-nano",
    tools: ["web_search", "image_generation"]
  },
  tutor: {
    system: "You are a patient STEM tutor. Explain step by step to help the user learn.",
    defaultModel: "gpt-4.1-nano",
    tools: ["web_search"]
  },
  general: {
    system: "You are a helpful, concise assistant.",
    defaultModel: "gpt-4.1-nano",
    tools: ["web_search"]
  },
  guide: {
    system: "You are a local guide. Ask clarifying location questions. Output friendly, energetic prose.",
    defaultModel: "gpt-4.1-nano",
    tools: ["web_search"]
  }
};
