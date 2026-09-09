"""User-authorized local checkerboard cleanup; keep backups and interior RGB unchanged."""
from pathlib import Path
from collections import deque
from PIL import Image, ImageFilter
import numpy as np
import shutil, json, hashlib
root=Path(__file__).resolve().parents[1]
backup=Path('/Users/johnshopinski/Documents/New project/crownforge-cursed-bear-concepts/uncleaned-sprites')
backup.mkdir(exist_ok=True)
report=[]
for path in sorted((root/'assets/cursed-bears').glob('*-v1.png')):
 if '-lore-' in path.name:continue
 im=Image.open(path)
 if im.mode=='RGBA':continue
 shutil.copyfile(path,backup/path.name)
 rgb=np.asarray(im.convert('RGB')).astype(np.int16);h,w=rgb.shape[:2]
 # The checkerboard is bright neutral gray; the fur and scars are chromatic.
 neutral=(rgb.max(2)-rgb.min(2)<=19)&(rgb.mean(2)>165)
 bg=np.zeros((h,w),bool);q=deque()
 for x in range(w):
  for y in [0,h-1]:
   if neutral[y,x]:bg[y,x]=True;q.append((y,x))
 for y in range(h):
  for x in [0,w-1]:
   if neutral[y,x] and not bg[y,x]:bg[y,x]=True;q.append((y,x))
 while q:
  y,x=q.pop()
  for yy,xx in [(y-1,x),(y+1,x),(y,x-1),(y,x+1)]:
   if 0<=yy<h and 0<=xx<w and neutral[yy,xx] and not bg[yy,xx]:bg[yy,xx]=True;q.append((yy,xx))
 # A subpixel edge avoids jagged silhouettes, without eroding connected fur.
 alpha=Image.fromarray(np.uint8(~bg)*255).filter(ImageFilter.GaussianBlur(.35))
 out=im.convert('RGBA');out.putalpha(alpha);out.save(path)
 report.append({'file':path.name,'original_sha256':hashlib.sha256((backup/path.name).read_bytes()).hexdigest(),'transparent_fraction':round(float(bg.mean()),5),'method':'bright-neutral flood fill from atlas boundary; 0.35px alpha feather; interior RGB preserved'})
 print(path.name,round(float(bg.mean()),3),flush=True)
(root/'art-notes/cursed-bears').mkdir(exist_ok=True)
(root/'art-notes/cursed-bears/local-alpha-cleanup.json').write_text(json.dumps({'authorization':'User: you may edit locally if needed, plz continue','backups':str(backup),'files':report},indent=2)+'\n')
