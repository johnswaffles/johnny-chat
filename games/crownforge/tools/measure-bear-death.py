"""Measure generated alpha cutouts; writes frame metadata, never raster pixels."""
from pathlib import Path
from collections import deque
import json
import numpy as np
from PIL import Image
root=Path(__file__).resolve().parents[1]
out={}
for view in ['se','ne']:
    version='v3' if view=='ne' else 'v1'
    path=root/'assets'/('painted-death-'+view+'-'+version+'.png')
    im=Image.open(path);assert im.mode=='RGBA'
    a=np.asarray(im)[:,:,3];mask=a>32;h,w=mask.shape;pieces=[]
    for y,x in zip(*np.where(mask)):
        if not mask[y,x]:continue
        q=deque([(int(y),int(x))]);mask[y,x]=False;rows={};count=0
        while q:
            yy,xx=q.pop();count+=1
            span=rows.setdefault(yy,[xx,xx]);span[0]=min(span[0],xx);span[1]=max(span[1],xx)
            for y2,x2 in [(yy-1,xx),(yy+1,xx),(yy,xx-1),(yy,xx+1)]:
                if 0<=y2<h and 0<=x2<w and mask[y2,x2]:mask[y2,x2]=False;q.append((y2,x2))
        if count>5000:pieces.append(rows)
    pieces.sort(key=lambda rows:min(rows));assert len(pieces)==4
    frames=[]
    for rows in pieces:
        x=max(0,min(v[0] for v in rows.values())-2);y=max(0,min(rows)-2)
        right=min(w,max(v[1] for v in rows.values())+3);bottom=min(h,max(rows)+3)
        clip=[]
        for yy in range(y,bottom):
            near=[rows[t] for t in range(yy-1,yy+2) if t in rows]
            if not near:continue
            left=max(x,min(v[0] for v in near)-1);end=min(right,max(v[1] for v in near)+2)
            if clip and clip[-1][0]==left-x and clip[-1][2]==end-left and clip[-1][1]+clip[-1][3]==yy-y:clip[-1][3]+=1
            else:clip.append([left-x,yy-y,end-left,1])
        frames.append({'rect':[x,y,right-x,bottom-y],'pivot':[(right-x)/2,bottom-y-7],'clip':clip})
    out[view]={'src':'./assets/'+path.name,'scaleBase':round(frames[0]['rect'][2]*({'se':323.229/313,'ne':367.592/280}[view]),3),'frames':frames}
    print(view,[f['rect'] for f in frames],out[view]['scaleBase'])
# A bear carries no handed equipment. Bilateral death views use the same
# complete paintings; walking and attacks retain all four approved atlases.
out['sw']={**out['se'],'flip':True,'scaleBase':round(out['se']['frames'][0]['rect'][2]*312.398/322,3)}
out['nw']={**out['ne'],'flip':True,'scaleBase':round(out['ne']['frames'][0]['rect'][2]*334.113/307,3)}
(root/'src/grizzly-death-art.js').write_text('// Generated alpha bounds and grounded pivots. Raster files are unchanged.\nexport const GRIZZLY_DEATH_ART='+json.dumps(out,separators=(',',':'))+';\n')
