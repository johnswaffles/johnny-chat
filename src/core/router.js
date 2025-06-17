import { MODELS } from "../config/models.js";

export function chooseModel(botConfig, userInput, extraTools = []) {
  let model = botConfig.defaultModel;
  let tools = [];

  const needsSearch = /\b(search|look\s*it\s*up|google|who is|what year)\b/i.test(userInput);
  const needsImage = extraTools.includes("image_generation");

  if (needsImage) {
    model = "gpt-4o";
    tools = [{ type: "web_search" }, { type: "image_generation" }];
  } else if (needsSearch) {
    model = "gpt-4o-mini-search-preview";
    tools = [{ type: "web_search" }];
  }

  return { model, tools };
}
