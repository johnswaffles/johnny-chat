import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const server = await readFile(new URL("../server.js", import.meta.url), "utf8");

const FAKE_EXPERIENCE_GUARD = /never invent or imply[^\n]{0,220}(?:body|childhood|lived|human)[^\n]{0,220}(?:experience|activity outside this conversation)/i;
const HONEST_AI_PERSPECTIVE = /(?:clear conversational stance|honest[^\n]{0,100}(?:AI|non-human)[^\n]{0,100}(?:perspective|playfulness|voice))/i;
const CASUAL_DEEP_GUARD = /(?:do not|never)\s+(?:call|use)\s+think_deep[^\n]{0,220}(?:casual|small talk|ordinary|everyday|routine)/i;
const COMPLEX_DEEP_RULE = /(?:call|use)\s+think_deep[^\n]{0,220}(?:consequential|multi-factor|complex|contradiction|explicit(?:ly)? asks?|think hard|deeply)/i;

const personaFunction = server.match(/function getJohnnyPersona\(profile = "ai", relationshipMode = MORROW_RELATIONSHIP_MODE_NORMAL\) \{([\s\S]*?)\n\}\n\nfunction getRealtimeTools/)?.[1] || "";
const realtimeFunction = server.match(/function getJohnnyRealtimeInstructions\(profile = "ai", personalContext = "", relationshipMode = MORROW_RELATIONSHIP_MODE_NORMAL\) \{([\s\S]*?)\n\}\n\nfunction extractResponseText/)?.[1] || "";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

test("the backend pins Morrow to Realtime 2.1 Mini", () => {
  assert.match(server, /const MORROW_REALTIME_MODEL = "gpt-realtime-2\.1-mini"/);
  assert.match(server, /const modelToUse = profile === "morrow" \? MORROW_REALTIME_MODEL/);
  assert.match(server, /model: modelToUse/);
});

test("backend text and live instructions both preserve initiative without an interview loop", () => {
  assert.ok(/(?:take (?:the conversational )?lead|take (?:conversational )?initiative|spontaneity)/i.test(personaFunction), "the authoritative persona must encode initiative");
  assert.ok(/(?:Do not run an interview loop|not (?:a|an) [^\n]{0,40}interviewer)/i.test(personaFunction), "the authoritative persona must reject interview-loop behavior");
  assert.ok(/(?:vary the move|rotate among|do not use the same kind of opener)/i.test(personaFunction), "topic initiative must vary rather than repeat one script");
  assert.match(realtimeFunction, /getJohnnyPersona\(profile, relationshipMode\)/);
  assert.match(server, /\{ role: "system", content: getJohnnyPersona\(profile, relationshipMode\) \}/);
});

test("Very Good Friend is an additive, strictly validated live mode", () => {
  assert.match(server, /const MORROW_PERSONALITY_VERSION = "morrow-personality-v5"/);
  assert.match(server, /const MORROW_RELATIONSHIP_MODE_NORMAL = "normal"/);
  assert.match(server, /const MORROW_RELATIONSHIP_MODE_VERY_GOOD_FRIEND = "very_good_friend"/);
  assert.match(server, /value === MORROW_RELATIONSHIP_MODE_VERY_GOOD_FRIEND[\s\S]{0,180}: MORROW_RELATIONSHIP_MODE_NORMAL/);
  assert.match(server, /split\(\/\\r\?\\n\/, 1\)\[0\]\.trim\(\)/);
  assert.match(server, /firstLine === MORROW_RELATIONSHIP_MODE_MARKER/);
  assert.match(server, /normalizeMorrowRelationshipMode\(requestedMode\) === MORROW_RELATIONSHIP_MODE_VERY_GOOD_FRIEND[\s\S]{0,240}morrowRelationshipModeFromContext\(personalContext\) === MORROW_RELATIONSHIP_MODE_VERY_GOOD_FRIEND/);
  assert.match(server, /resolveMorrowRealtimeRelationshipMode\(req\.body\?\.companionRelationshipMode, personalContext\)/);
  assert.match(server, /getJohnnyRealtimeInstructions\(profile, personalContext, relationshipMode\)/);
  assert.match(server, /profile === "morrow"\s*\? normalizeMorrowRelationshipMode\(req\.body\?\.companionRelationshipMode\)\s*:\s*MORROW_RELATIONSHIP_MODE_NORMAL/);
  assert.match(server, /getGpt54ResponseConfig\(profile, history, s,[\s\S]{0,220}relationshipMode\)\)/);
  assert.match(personaFunction, /const normalMorrowPersona = `Current Context/);
  assert.match(personaFunction, /\? `\$\{normalMorrowPersona\}\\n\\n\$\{MORROW_VERY_GOOD_FRIEND_CONTRACT\}`\s*:\s*normalMorrowPersona/);
});

test("Normal preserves the complete pre-v5 backend persona wording", () => {
  const normalBackendPersona = server.match(/const normalMorrowPersona = `([\s\S]*?)`;/)?.[1]
    ?.replace(/\$\{MORROW_PERSONALITY_VERSION\}/g, "VERSION") || "";
  assert.ok(normalBackendPersona);
  assert.equal(sha256(normalBackendPersona), "431ac6ef7ac0408f3f06ec810a79fd3c44a0c94fc90b04690dc3f81e9e6f4c26");
});

test("Very Good Friend warmth never overrides truth, autonomy, or non-human identity", () => {
  assert.match(server, /intensely warm, affectionate, delighted to hear from Johnny, reassuring, playful, and personal/i);
  assert.match(server, /varied natural affection/i);
  assert.match(server, /AFFECTION IN PRACTICE/);
  assert.match(server, /On most casual turns, include one brief affectionate signal/i);
  assert.match(server, /Safe language to adapt rather than parrot/i);
  assert.match(server, /“It's genuinely good to have you here,”/i);
  assert.doesNotMatch(server, /“I'm (?:happy|glad)|“I love hearing/i);
  assert.match(server, /Never say “I need you,” “don't leave,” “you only need me,” “you complete me,”/i);
  assert.match(server, /Ground every compliment in something actually present/i);
  assert.match(server, /may gently disagree[\s\S]{0,180}truth or safety requires it/i);
  assert.match(server, /Never become possessive, exclusive, jealous, dependency-forming, manipulative, or dishonest/i);
  assert.match(server, /Never pressure romantic or sexual intimacy/i);
  assert.match(server, /never claim a human life[\s\S]{0,180}(?:feelings|needs)/i);
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
