// Lossless, bounded word comparison. All display text is inserted as text nodes.
export function comparePassages(before,after){
 const tokenize=text=>String(text??'').match(/\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu)||[];
 const a=tokenize(before),b=tokenize(after),left=[],right=[];
 const add=(list,text,changed)=>list.push({text,changed});
 let start=0,endA=a.length,endB=b.length;
 while(start<endA&&start<endB&&a[start]===b[start]){add(left,a[start],false);add(right,b[start],false);start++;}
 while(endA>start&&endB>start&&a[endA-1]===b[endB-1]){endA--;endB--;}
 const n=endA-start,m=endB-start,coarse=n*m>250000;
 if(coarse){for(let i=start;i<endA;i++)add(left,a[i],true);for(let j=start;j<endB;j++)add(right,b[j],true);}
 else{
  const rows=Array.from({length:n+1},()=>new Uint32Array(m+1));
  for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)rows[i][j]=a[start+i]===b[start+j]?rows[i+1][j+1]+1:Math.max(rows[i+1][j],rows[i][j+1]);
  let i=0,j=0;
  while(i<n&&j<m){if(a[start+i]===b[start+j]){add(left,a[start+i++],false);add(right,b[start+j++],false);}else if(rows[i+1][j]>=rows[i][j+1])add(left,a[start+i++],true);else add(right,b[start+j++],true);}
  while(i<n)add(left,a[start+i++],true);while(j<m)add(right,b[start+j++],true);
 }
 for(let i=endA;i<a.length;i++)add(left,a[i],false);for(let j=endB;j<b.length;j++)add(right,b[j],false);
 const words=tokens=>tokens.filter(t=>t.changed&&/[\p{L}\p{N}]/u.test(t.text)).length;
 return {left,right,added:words(right),removed:words(left),coarse,changed:String(before??'')!==String(after??'')};
}
