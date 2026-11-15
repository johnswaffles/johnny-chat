// Temporary single-picture preview. Turn this off when the collection is ready.
export const singlePicturePreview=true;
export const previewPaintingId='alpine-retreat-v2';
export const isPaintingAvailable=id=>!singlePicturePreview||id===previewPaintingId;

export function nextUnfinishedColor(remaining,current){
  for(let offset=1;offset<=remaining.length;offset++){
    const color=(current+offset)%remaining.length;if(remaining[color]>0)return color;
  }
  return current;
}
