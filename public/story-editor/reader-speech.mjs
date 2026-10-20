function pause(ms, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    signal.addEventListener('abort', abort, {once:true});
    if (signal.aborted) abort();
  });
}

export async function chapterAudio(url, {part, revision, headers, signal, onPending = () => {}, fetcher = fetch, pollMs = 1000, timeoutMs = 90000}) {
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]);
  const query = new URLSearchParams({part:String(part), revision});
  let polling = false;
  try {
    while (true) {
      const response = await fetcher(polling ? `${url}?${query}` : url, {
        method:polling ? 'GET' : 'POST', headers,
        signal:AbortSignal.any([deadline, AbortSignal.timeout(15000)]),
        ...(polling ? {} : {body:JSON.stringify({part, revision, async:true})})
      });
      if (response.status === 202) {
        onPending(); polling = true; await pause(pollMs, deadline); continue;
      }
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || (response.status === 524 || response.status === 504
          ? 'The audio service took too long to respond. Please try again.'
          : 'Narration could not be loaded. Please try again.'));
      }
      if (!response.headers.get('content-type')?.startsWith('audio/')) throw new Error('The audio service returned an unexpected response. Please try again.');
      return await response.blob();
    }
  } catch (error) {
    if (signal.aborted) throw error;
    if (error.name === 'TimeoutError' || deadline.aborted) throw new Error('Audio preparation took too long. Choose Listen to retry.');
    if (error instanceof TypeError) throw new Error('The connection to the audio service was interrupted. Please try again.');
    throw error;
  }
}
