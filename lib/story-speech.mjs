// Narration is an ephemeral, bounded task cache, separate from editorial jobs.
// Only start() can call the provider. read() is safe to poll after a lost response.
export function createStorySpeech({ timeoutMs = 60000, maxBytes = 32 * 1024 * 1024, maxPending = 3, maxEntries = 200, onError = () => {} } = {}) {
  const entries = new Map();
  let bytes = 0, pending = 0;
  function read(key) { return entries.get(key); }
  function remove(key, entry) { entries.delete(key); bytes -= entry.audio?.length || 0; }
  function start(key, generate) {
    const existing = read(key);
    if (existing && existing.status !== 'failed') return existing;
    if (pending >= maxPending) return { status: 'busy' };
    if (existing) remove(key, existing);
    const entry = { status: 'pending' };
    entries.set(key, entry); pending++;
    const controller = new AbortController();
    let timer;
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error('speech_timeout')); }, timeoutMs);
    });
    entry.done = Promise.race([Promise.resolve().then(() => generate(controller.signal)), deadline])
      .then(audio => {
        if (!audio.length || audio.length > maxBytes) throw new Error('speech_size');
        while (bytes + audio.length > maxBytes) {
          const oldest = [...entries].find(([, item]) => item.audio);
          if (!oldest) break;
          remove(...oldest);
        }
        entry.audio = audio; bytes += audio.length; entry.status = 'ready';
      })
      .catch(error => { entry.status = 'failed'; onError(error); })
      .finally(() => {
        clearTimeout(timer); pending--;
        // Bound metadata too, including failed tasks. Never evict running work.
        for (const [oldKey, item] of entries) {
          if (entries.size <= maxEntries) break;
          if (item.status !== 'pending') remove(oldKey, item);
        }
      });
    return entry;
  }
  return { read, start };
}
