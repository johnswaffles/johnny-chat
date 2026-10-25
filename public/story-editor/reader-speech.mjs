import {narrationHeader} from './narration-model.mjs';
function pause(ms, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    signal.addEventListener('abort', abort, {once:true});
    if (signal.aborted) abort();
  });
}

export async function chapterAudio(url, {part, revision, sectionId, narration, headers, signal, onPending = () => {}, fetcher = fetch, pollMs = 1000, timeoutMs = 90000}) {
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]);
  const selection = sectionId ? {sectionId} : {};
  const query = new URLSearchParams({part:String(part), revision, ...selection});
  let polling = false;
  try {
    while (true) {
      const response = await fetcher(polling ? `${url}?${query}` : url, {
        method:polling ? 'GET' : 'POST', headers:{...headers,...(narration?{'X-Story-Narration':narrationHeader(narration)}:{})},
        signal:AbortSignal.any([deadline, AbortSignal.timeout(15000)]),
        ...(polling ? {} : {body:JSON.stringify({part, revision, async:true, ...selection})})
      });
      if (response.status === 202) {
        onPending(); polling = true; await pause(pollMs, deadline); continue;
      }
      if (response.status === 401) throw Object.assign(new Error('Your private session needs unlocking. Unlock the studio again, then press Read to listen.'),{code:'AUTH_REQUIRED',status:401});
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
