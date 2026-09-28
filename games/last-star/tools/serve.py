from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import os
os.chdir(Path(__file__).resolve().parents[1])
class Handler(SimpleHTTPRequestHandler):
 def do_POST(self):
  # Fixed local QA recording destination; never accepts arbitrary filesystem paths.
  if self.path!='/qa-recording' or self.headers.get('Origin')!='http://127.0.0.1:4198':
   self.send_error(403);return
  length=int(self.headers.get('Content-Length','0'))
  if not 0<length<=30_000_000:
   self.send_error(413);return
  Path('output').mkdir(exist_ok=True)
  Path('output/level1-gameplay.webm').write_bytes(self.rfile.read(length))
  self.send_response(201);self.end_headers();self.wfile.write(b'output/level1-gameplay.webm')
 def end_headers(self):
  self.send_header('Cache-Control','no-store');super().end_headers()
ThreadingHTTPServer(('127.0.0.1',4198),Handler).serve_forever()
