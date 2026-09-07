"""Find whole painted sprites and return non-destructive Canvas crop/clip metadata."""
import numpy as np

def measure_grid(alpha, rows=4):
 mask=alpha>24
 # Separate adjacent sprite cells along the emptiest nearby gutter. This affects
 # only crop measurement, never the saved image or character painting pixels.
 for k in range(1,rows):
  c=round(mask.shape[0]*k/rows);pad=round(mask.shape[0]*.035);lo=c-pad;hi=c+pad
  counts=mask[lo:hi].sum(axis=1);minimum=counts.min();candidates=np.where(counts==minimum)[0]+lo;cut=int(candidates[np.argmin(abs(candidates-c))]);mask[cut,:]=False
 for row in range(rows):
  top=round(row*mask.shape[0]/rows);bottom=round((row+1)*mask.shape[0]/rows)
  for k in range(1,4):
   c=round(mask.shape[1]*k/4);pad=round(mask.shape[1]*.03);lo=c-pad;hi=c+pad
   counts=mask[top:bottom,lo:hi].sum(axis=0);minimum=counts.min();candidates=np.where(counts==minimum)[0]+lo;cut=int(candidates[np.argmin(abs(candidates-c))]);mask[top:bottom,cut]=False
 parent=[];spans=[];previous=[]
 def find(n):
  while parent[n]!=n:parent[n]=parent[parent[n]];n=parent[n]
  return n
 for y,row in enumerate(mask):
  e=np.diff(np.r_[False,row,False].astype(np.int8));starts=np.where(e==1)[0];ends=np.where(e==-1)[0];current=[];j=0
  for x0,x1 in zip(starts,ends):
   ident=len(parent);parent.append(ident)
   while j<len(previous) and previous[j][1]<x0:j+=1
   k=j
   while k<len(previous) and previous[k][0]<=x1:
    a=find(ident);b=find(previous[k][2]);parent[a]=b;k+=1
   spans.append((y,int(x0),int(x1),ident));current.append((int(x0),int(x1),ident))
  previous=current
 components={}
 for y,x0,x1,ident in spans:
  k=find(ident);components.setdefault(k,[]).append((y,x0,x1))
 items=[]
 for spanset in components.values():
  area=sum(x1-x0 for y,x0,x1 in spanset)
  if area<300:continue
  x0=min(a for y,a,b in spanset);x1=max(b for y,a,b in spanset);y0=spanset[0][0];y1=spanset[-1][0]+1
  items.append({'area':area,'rows':spanset,'box':(x0,y0,x1,y1),'cy':sum(y*(b-a) for y,a,b in spanset)/area})
 items=sorted(items,key=lambda v:v['area'],reverse=True)[:rows*4]
 assert len(items)==rows*4,('Need complete sprites',len(items),rows*4)
 items.sort(key=lambda v:v['cy']);grid=[]
 for row in range(rows):grid.extend(sorted(items[row*4:row*4+4],key=lambda v:(v['box'][0]+v['box'][2])/2))
 result=[]
 for item in grid:
  x0,y0,x1,y1=item['box'];x0=max(0,x0-3);y0=max(0,y0-3);x1=min(alpha.shape[1],x1+3);y1=min(alpha.shape[0],y1+3)
  own=np.zeros((y1-y0,x1-x0),bool)
  for y,a,b in item['rows']:own[y-y0,a-x0:b-x0]=True
  for _ in range(3):
   padded=np.pad(own,1);own=np.logical_or.reduce([padded[dy:dy+own.shape[0],dx:dx+own.shape[1]] for dy in range(3) for dx in range(3)])
  clips=[];active={}
  for y,rowmask in enumerate(own):
   e=np.diff(np.r_[False,rowmask,False].astype(np.int8));curr={}
   for a,b in zip(np.where(e==1)[0],np.where(e==-1)[0]):
    key=(int(a),int(b-a))
    if key in active:r=active[key];r[3]+=1
    else:r=[key[0],y,key[1],1];clips.append(r)
    curr[key]=r
   active=curr
  result.append({'rect':[x0,y0,x1-x0,y1-y0],'clip':clips,'area':item['area']})
 return result
