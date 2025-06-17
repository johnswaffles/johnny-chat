import { openai } from "../core/openai.js";
import { chooseModel } from "../core/router.js";
import { BOTS } from "../config/bots.js";
import { runWebSearch } from "../tools/webSearch.js";

export async function chat(botId, history, userInput, extraTools = []) {
  const bot = BOTS[botId];
  if (!bot) throw new Error(`Unknown bot '${botId}'`);

  const { model, tools } = chooseModel(bot, userInput, extraTools);

  const messages = [
    { role: "system", content: bot.system },
    ...history,
    { role: "user", content: userInput }
  ];

  const first = await openai.chat.completions.create({
    model,
    messages,
    tools,
    tool_choice: "auto"
  });

  const msg = first.choices[0].message;

  if (!msg.tool_calls) {
    return { answer: msg.content.trim() };
  }

  const toolResponses = [];
  for (const call of msg.tool_calls) {
    switch (call.name) {
      case "web_search":
        const { query } = JSON.parse(call.arguments);
        const result = await runWebSearch(query);
        toolResponses.push({
          role: "tool",
          tool_call_id: call.id,
          name: "web_search",
          content: result
        });
        break;
      default:
        throw new Error(`Unhandled tool call ${call.name}`);
    }
  }

  const second = await openai.chat.completions.create({
    model,
    messages: [...messages, msg, ...toolResponses]
  });

  return { answer: second.choices[0].message.content.trim() };
}
