import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

const source = await readFile(new URL('../server.js', import.meta.url), 'utf8');
const config = source.slice(source.indexOf('function getGpt54ResponseConfig('), source.indexOf('function normalizeWidgetProfile('));
const route = source.slice(source.indexOf('app.post("/api/chat",'), source.indexOf('app.post("/api/chat-stream",'));
const constant = source.match(/const MORROW_DEEP_THINK_MODEL = [^;]+;/)[0];

function harness(result = { status: 'completed', model: 'gpt-6-astra', text: 'A careful answer.' }) {
  const calls = [];
  let handler;
  const context = vm.createContext({
    OPENAI_GPT54_MODEL: 'legacy-model', OPENAI_CHAT_MODEL: 'ordinary-model', OPENAI_GPT54_REASONING_EFFORT: 'low',
    getJohnnyPersona: () => 'Existing persona',
    inferWidgetProfile: req => req.body.profile,
    requireChatbotSession: (req, res) => req.authenticated || (res.status(401).json({ error: 'Unauthorized' }), false),
    isLiveQuery: () => false,
    recordJohnnyChatUsage: () => {},
    extractResponseText: r => r.text || '', extractResponseSources: () => [],
    openai: { responses: { create: async request => { calls.push(request); return result; } } },
    app: { post: (_path, callback) => { handler = callback; } },
  });
  vm.runInContext(constant + '\n' + config + '\n' + route, context);
  return { calls, async run(body, authenticated = true) {
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
    await handler({ body: { input: 'Compare these options.', history: [], ...body }, authenticated }, res);
    return res;
  } };
}

test('authenticated deep thinking selects Astra/xhigh despite older shared model settings', async () => {
  const h = harness();
  const result = await h.run({ profile: 'morrow', task: 'deep_think', safetyIdentifier: 'a'.repeat(64) });
  assert.equal(result.statusCode, 200);
  assert.equal(h.calls[0].model, 'gpt-6-astra');
  assert.equal(h.calls[0].reasoning.effort, 'xhigh');
  assert.equal(h.calls[0].safety_identifier, 'a'.repeat(64));
  assert.equal(h.calls[0].tools[0].type, 'web_search');
  assert.equal(result.body.model, 'gpt-6-astra');
  assert.equal(result.body.reasoningEffort, 'xhigh');
});

test('ordinary Morrow and other chat profiles retain their existing models', async () => {
  const h = harness();
  await h.run({ profile: 'morrow' });
  await h.run({ profile: 'gpt54', task: 'deep_think' });
  await h.run({ profile: 'community', task: 'deep_think' });
  assert.deepEqual(h.calls.map(r => r.model), ['legacy-model', 'legacy-model', 'ordinary-model']);
});

test('deep thinking still requires authentication before an API call', async () => {
  const h = harness();
  assert.equal((await h.run({ profile: 'morrow', task: 'deep_think' }, false)).statusCode, 401);
  assert.equal(h.calls.length, 0);
});

test('unfinished or empty Astra results fail instead of becoming a spoken completed answer', async () => {
  for (const result of [{ status: 'incomplete', text: 'Partial answer' }, { status: 'completed', text: '' }]) {
    const h = harness(result);
    const response = await h.run({ profile: 'morrow', task: 'deep_think' });
    assert.equal(response.statusCode, 502);
    assert.equal(response.body.reply, undefined);
    assert.equal(h.calls.length, 1);
  }
});
