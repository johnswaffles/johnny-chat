// Read-only advisory probes: fixed public endpoints, no credentials or manuscript.
// Run in the deployed service's own shell to verify production (local != Render).
import tls from 'node:tls';
import {pathToFileURL} from 'node:url';
import {getRuntime} from 'openai/_shims/node-runtime';
import WebSocket from 'ws';
export const TARGETS=Object.freeze(['https://dv-g3b-emudhra.we-have-a-problem.com/','https://dv-g3b-aaa-emudhra.we-have-a-problem.com/']);
export const CONTROL='https://nodejs.org/';
export function patchedRuntime(version){const [major,minor,patch]=version.replace(/^v/,'').split('.').map(Number),minimum={22:[23,4],24:[22,1],26:[12,1]}[major];return !!minimum&&(minor>minimum[0]||(minor===minimum[0]&&patch>=minimum[1]));}
export function certificateError(error){for(let e=error;e;e=e.cause){const code=String(e.code||'');if(/CERT_|CERTIFICATE_|SELF_SIGNED|UNABLE_TO_VERIFY|UNABLE_TO_GET_ISSUER/.test(code))return code;}return null;}
export function runtimeInfo(){return {node:process.version,openssl:process.versions.openssl,patchedVersion:patchedRuntime(process.version),trustFlags:[...process.execArgv,...String(process.env.NODE_OPTIONS||'').split(/\s+/)].filter(x=>/^--use-(openssl|system|bundled)-ca$/.test(x)),caOverridesPresent:['NODE_EXTRA_CA_CERTS','SSL_CERT_FILE','SSL_CERT_DIR'].filter(x=>!!process.env[x]),verificationDisabled:process.env.NODE_TLS_REJECT_UNAUTHORIZED==='0',defaultCaCount:tls.getCACertificates?tls.getCACertificates('default').length:tls.rootCertificates.length};}
export async function check(client,url,request){try{const response=await request(url);return {client,url,outcome:'tls_accepted',...(response?.status?{httpStatus:response.status}:{})};}catch(error){const code=certificateError(error);return {client,url,outcome:code?'certificate_rejected':'inconclusive',code:code||(/^[A-Z0-9_]+$/.test(String(error.code||''))?error.code:error.name||'network_error')};}}
async function fetchProbe(fetcher,url,options={}){const response=await fetcher(url,{redirect:'manual',signal:AbortSignal.timeout(10000),...options});if(response.body?.cancel)await response.body.cancel().catch(()=>{});else response.body?.destroy?.();return {status:response.status};}
function socketProbe(url){return new Promise((resolve,reject)=>{const ws=new WebSocket(url.replace(/^https:/,'wss:'),{handshakeTimeout:10000,followRedirects:false});let settled=false;const done=(error,status)=>{if(settled)return;settled=true;if(ws.readyState===0||ws.readyState===1)ws.terminate();error?reject(error):resolve({status});};ws.on('open',()=>done(null,101));ws.on('unexpected-response',(request,response)=>{response.destroy();request.destroy();done(null,response.statusCode);});ws.on('error',error=>done(error));ws.on('close',()=>{if(!settled)done(Error('Connection closed without a TLS result.'));});});}
export function verdict(results){return results.length===9&&['fetch','openai-node-fetch','ws'].every(client=>results.some(r=>r.client===client&&r.url===CONTROL&&r.outcome==='tls_accepted')&&TARGETS.every(url=>results.some(r=>r.client===client&&r.url===url&&r.outcome==='certificate_rejected')));}
export async function probe(){
 const info=runtimeInfo();console.log(JSON.stringify({runtime:info}));if(info.verificationDisabled){console.log('FAIL: certificate verification is disabled; no requests sent.');return false;}
 const sdk=getRuntime(),clients=[['fetch',url=>fetchProbe(fetch,url)],['openai-node-fetch',url=>fetchProbe(sdk.fetch,url,{agent:sdk.getDefaultAgent(url)})],['ws',socketProbe]];
 const results=await Promise.all(clients.flatMap(([client,request])=>[CONTROL,...TARGETS].map(url=>check(client,url,request))));for(const result of results)console.log(JSON.stringify(result));
 const good=verdict(results);console.log(good?'PASS: all three app TLS clients reject both advisory endpoints; control TLS works.':'NOT VERIFIED: an endpoint was trusted or a network/protocol failure was inconclusive.');
 // Retire only this diagnostic process's keep-alive agents, never a running app's.
 sdk.getDefaultAgent(CONTROL).destroy();return good&&info.patchedVersion;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){if(process.argv.includes('--probe'))process.exitCode=await probe()?0:1;else if(process.argv.includes('--require-patched')){const info=runtimeInfo();console.log(JSON.stringify({securityRuntime:info}));if(!info.patchedVersion||info.verificationDisabled){console.error('Refusing an unpatched Node runtime or disabled TLS verification. Use the repository .node-version.');process.exitCode=1;}}else console.log(JSON.stringify({runtime:runtimeInfo(),usage:'Run with --probe in the actual service shell. No browser, API key or paid provider call is used.'}));}
