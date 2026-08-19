import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const server = await readFile(new URL("../server.js", import.meta.url), "utf8");

const FAKE_EXPERIENCE_GUARD = /never invent or imply[^\n]{0,220}(?:body|childhood|lived|human)[^\n]{0,220}(?:experience|activity outside this conversation)/i;
const HONEST_AI_PERSPECTIVE = /(?:clear conversational stance|honest[^\n]{0,100}(?:AI|non-human)[^\n]{0,100}(?:perspective|playfulness|voice))/i;
const CASUAL_DEEP_GUARD = /(?:do not|never)\s+(?:call|use)\s+think_deep[^\n]{0,220}(?:casual|small talk|ordinary|everyday|routine)/i;
const COMPLEX_DEEP_RULE = /(?:call|use)\s+think_deep[^\n]{0,220}(?:consequential|multi-factor|complex|contradiction|explicit(?:ly)? asks?|think hard|deeply)/i;

const personaFunction = server.match(/function getJohnnyPersona\(profile = "ai"\) \{([\s\S]*?)\n\}\n\nfunction getRealtimeTools/)?.[1] || "";
const realtimeFunction = server.match(/function getJohnnyRealtimeInstructions\(profile = "ai", personalContext = ""\) \{([\s\S]*?)\n\}\n\nfunction extractResponseText/)?.[1] || "";

test("the backend pins Morrow to Realtime 2.1 Mini", () => {
  assert.match(server, /const MORROW_REALTIME_MODEL = "gpt-realtime-2\.1-mini"/);
  assert.match(server, /const modelToUse = profile === "morrow" \? MORROW_REALTIME_MODEL/);
  assert.match(server, /model: modelToUse/);
});

test("backend text and live instructions both preserve initiative without an interview loop", () => {
  assert.ok(/(?:take (?:the conversational )?lead|take (?:conversational )?initiative|spontaneity)/i.test(personaFunction), "the authoritative persona must encode initiative");
  assert.ok(/(?:Do not run an interview loop|not (?:a|an) [^\n]{0,40}interviewer)/i.test(personaFunction), "the authoritative persona must reject interview-loop behavior");
  assert.ok(/(?:vary the move|rotate among|do not use the same kind of opener)/i.test(personaFunction), "topic initiative must vary rather than repeat one script");
  assert.match(realtimeFunction, /getJohnnyPersona\(profile\)/);
  assert.match(server, /\{ role: "system", content: getJohnnyPersona\(profile\) \}/);
});

test("Morrow never fabricates a human backstory but can offer honest AI-shaped perspective", () => {
  assert.ok(FAKE_EXPERIENCE_GUARD.test(personaFunction), "the shared backend persona must ban fabricated lived experience");
  assert.ok(HONEST_AI_PERSPECTIVE.test(personaFunction), "the shared backend persona must allow an honest AI perspective");
  assert.ok(/You are not human|Never claim to be human/i.test(personaFunction), "Morrow must never claim human identity");
});

test("think_deep is available for difficult work but forbidden for routine conversation", () => {
  assert.match(server, /name: "think_deep"/);
  assert.match(server, /required: \["request"\]/);
  assert.ok(COMPLEX_DEEP_RULE.test(server), "complex and explicit requests may call think_deep");
  assert.ok(CASUAL_DEEP_GUARD.test(server), "casual chat and small talk must never call think_deep");
  assert.match(server, /read-only handoff|It is read-only/);
});
