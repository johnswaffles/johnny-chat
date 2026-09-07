"""Read original and generated alpha; write frame mapping only. Never modify PNGs."""
from pathlib import Path
from PIL import Image
import json, hashlib, numpy as np
from atlas_measure import measure_grid
BASE=Path(__file__).resolve().parents[1]
GAME=Path('/private/tmp/crownforge-building-release-20260905/games/crownforge')
art=json.loads(Path('/private/tmp/crown-art.json').read_text())
manifest=json.loads((BASE/'source-manifest.json').read_text())
source={d['source']:d for d in manifest}
cache={}
def measure(path,rows):
 if str(path) not in cache:
  im=Image.open(path);assert im.mode=='RGBA',(str(path),im.mode)
  alpha=np.array(im)[:,:,3];assert (alpha==0).mean()>.2
  cache[str(path)]=(im.size,measure_grid(alpha,rows))
 return cache[str(path)]
def iou(a,b):
 x,y,w,h=a;u,v,j,k=b;n=max(0,min(x+w,u+j)-max(x,u))*max(0,min(y+h,v+k)-max(y,v));return n/(w*h+j*k-n)
result={};report={};missing=set()
for view,actions in art.items():
 result[view]={}
 for action,old in actions.items():
  d=source[old['src']];key=d['id'].split('-')[1]
  if action in ['idle','walk']:key='loco-'+view
  if key=='04':key='01'
  if action=='carry_wood':key='06'
  path=BASE/'assets'/(key+'.png')
  if not path.exists():missing.add(key);continue
  (ow,oh),og=measure(GAME/old['src'],d['rows']);(nw,nh),ng=measure(path,d['rows'])
  indices=[max(range(len(og)),key=lambda n:iou(f['rect'],og[n]['rect'])) for f in old['frames']]
  if action=='carry_wood':indices=list(range({'sw':0,'se':4,'ne':8,'nw':12}[view],{'sw':0,'se':4,'ne':8,'nw':12}[view]+4))
  frames=[]
  for f,idx in zip(old['frames'],indices):
   n=ng[idx];x,y,w,h=n['rect'];ox,oy,owidth,oheight=f['rect']
   # Preserve the original ground anchor's position within the character bounds,
   # including the authored floor offset for lifted feet and collapse poses.
   pivot=[round(f['pivot'][0]/owidth*w,2),round(f['pivot'][1]/oheight*h,2)]
   frames.append({'rect':n['rect'],'clip':n['clip'],'pivot':pivot})
  ratios=[ng[idx]['rect'][3]/f['rect'][3] for f,idx in zip(old['frames'],indices)]
  scale=round(old['scaleBase']*float(np.median(ratios)),2)
  result[view][action]={'src':'./assets/ashen-hearthkin-painted/'+key+'.png','scaleBase':scale,'frames':frames}
  report.setdefault(key,{'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'size':[nw,nh],'cells':len(ng),'clips':[]})['clips'].append({'view':view,'action':action,'indices':indices})
if missing:print('Missing:',sorted(missing))
(BASE/'art-partial.json').write_text(json.dumps(result,separators=(',',':')))
(BASE/'ART_ANALYSIS.json').write_text(json.dumps(report,indent=2))
if not missing:
 (BASE/'ashen-hearthkin-painted-art.js').write_text('// Built-in imagegen paintings; measured alpha crops preserve original PNG bytes.\nexport const ASHEN_HEARTHKIN_PAINTED_ART='+json.dumps(result,separators=(',',':'))+';\n')
 print('Complete frames',sum(len(s['frames']) for v in result.values() for s in v.values()))
