"""Pack independently rendered views, retaining measured ground pivots."""
from PIL import Image
from pathlib import Path
import json,hashlib
D=Path('/private/tmp/hearthkin-game-frames');R=Path(__file__).resolve().parents[2];out=R/'assets/hearthkin-blender-v007';out.mkdir(exist_ok=True)
records=json.loads((D/'manifest.json').read_text());art={};edge_hits=[]
calibration={}
for c in records:
 if c['name']=='Idle':
  box=Image.open(D/'Idle'/c['view']/'000.png').getchannel('A').getbbox();calibration[c['view']]=c['pivot'][1]-box[1]
for c in records:
 name,view=c['name'],c['view'];tiles=[];frames=[]
 for i in range(c['count']):
  im=Image.open(D/name/view/f'{i:03d}.png').convert('RGBA');box=im.getchannel('A').getbbox();tiles.append((im,box))
 rows=[tiles[i:i+4] for i in range(0,len(tiles),4)];width=max(sum(b[2]-b[0]+4 for _,b in row) for row in rows);height=sum(max(b[3]-b[1]+4 for _,b in row) for row in rows);sheet=Image.new('RGBA',(width,height));row_y=0;row_x=0;row_height=0
 for i in range(c['count']):
  im=Image.open(D/name/view/f'{i:03d}.png').convert('RGBA');box=im.getchannel('A').getbbox();assert box,(name,view,i)
  if box[0]<2 or box[1]<2 or box[2]>im.width-2 or box[3]>im.height-2:edge_hits.append([name,view,i,box])
  if i%4==0 and i:row_y+=row_height;row_x=0;row_height=0
  l,t,r,b=box;x,y=row_x+2,row_y+2;sheet.paste(im.crop(box),(x,y));frames.append({'rect':[x,y,r-l,b-t],'pivot':[c['pivot'][0]-l,c['pivot'][1]-t]});row_x+=r-l+4;row_height=max(row_height,b-t+4)
 path=out/f'{name}-{view}.webp';sheet.save(path,'WEBP',quality=90,method=4)
 art.setdefault(view,{})[name]={'src':f'./assets/hearthkin-blender-v007/{path.name}','scaleBase':calibration[view],'frames':frames,'loop':c['loop'],'contact':c['contact_phase'],'seconds':c['seconds']}
(R/'src/hearthkin-blender-art.js').write_text('export const HEARTHKIN_BLENDER_ART='+json.dumps(art,separators=(',',':'))+';\n')
(out/'provenance.json').write_text(json.dumps({'source':'Hearthkin Worker v007 with September 11 field, crate and shield corrections','view_count':4,'clip_count':len(art.get('se',{})),'clips':records,'edge_hits':edge_hits,'assets':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in out.glob('*.webp')}},indent=2))
print('PACKED',len(records),'SHEETS; EDGE_HITS',edge_hits)
