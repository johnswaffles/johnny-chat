"""Measure generated alpha components and write metadata; never modify raster pixels."""
from pathlib import Path
from collections import deque
import json
import numpy as np
from PIL import Image
root=Path(__file__).resolve().parents[1]
data={}
for name in ['black-oath','cindermaw','ashen-grudge']:
 data[name]={}
 for view in ['se','sw','ne','nw']:
  path=root/f'assets/cursed-bears/{name}-{view}-v1.png'
  im=Image.open(path);assert im.mode=='RGBA',f'{path}: real alpha required'
  a=np.asarray(im)[:,:,3];mask=a>32;h,w=a.shape
  # Two neighboring Cindermaw paintings touch by a few guard hairs.
  # Separate their measured components at the narrow seam; keep source pixels.
  if name=='cindermaw' and view=='sw':mask[707,:320]=False
  assert (a==0).mean()>.15,f'{path}: opaque background'
  pieces=[]
  for y,x in zip(*np.where(mask)):
   if not mask[y,x]:continue
   q=deque([(int(y),int(x))]);mask[y,x]=False;rows={};count=0;sum_y=0;sum_x=0
   while q:
    yy,xx=q.pop();count+=1;sum_y+=yy;sum_x+=xx
    span=rows.setdefault(yy,[xx,xx]);span[0]=min(span[0],xx);span[1]=max(span[1],xx)
    for y2,x2 in [(yy-1,xx),(yy+1,xx),(yy,xx-1),(yy,xx+1)]:
     if 0<=y2<h and 0<=x2<w and mask[y2,x2]:mask[y2,x2]=False;q.append((y2,x2))
   if count>3000:pieces.append((sum_y/count,sum_x/count,rows))
  assert len(pieces)==20,f'{path}: {len(pieces)} connected bears, expected 20'
  pieces.sort();actions={};idle_heights=[]
  for row,action in enumerate(['idle','walk','swipe','rear','death']):
   frames=[]
   for col,(_,_,rows) in enumerate(sorted(pieces[row*4:row*4+4],key=lambda p:p[1])):
    left=max(0,min(v[0] for v in rows.values())-2);right=min(w,max(v[1] for v in rows.values())+3)
    top=max(0,min(rows)-2);bottom=min(h,max(rows)+3);clip=[]
    for yy in range(top,bottom):
     spans=[rows[t] for t in range(yy-2,yy+3) if t in rows]
     if not spans:continue
     x=max(left,min(v[0] for v in spans)-2);end=min(right,max(v[1] for v in spans)+3)
     if clip and clip[-1][0]==x-left and clip[-1][2]==end-x and clip[-1][1]+clip[-1][3]==yy-top:clip[-1][3]+=1
     else:clip.append([x-left,yy-top,end-x,1])
    f={'rect':[left,top,right-left,bottom-top],'pivot':[round((col+.5)*w/4-left,2),bottom-top-3],'clip':clip}
    if action=='rear':f['sizeFactor']=[1.12,1.4,1.35,1][col]
    if action=='death':f['sizeFactor']=[1,1.06,1.1,1.1][col]
    frames.append(f)
    if row==0:idle_heights.append(bottom-top)
   actions[action]={'src':f'./assets/cursed-bears/{path.name}','scaleBase':float(np.median(idle_heights)),'frames':frames}
  data[name][view]=actions
  print(name,view,im.size,'transparent',round(float((a==0).mean()),3),'20 whole paintings',flush=True)
(root/'src/cursed-bear-art.js').write_text('// Measured alpha contours; source raster pixels unchanged.\nexport const CURSED_BEAR_ART='+json.dumps(data,separators=(',',':'))+';\n')
