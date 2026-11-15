import {makePuzzle} from './engine.js';
self.onmessage = ({data}) => {
  try {
    const puzzle=makePuzzle(new Uint8ClampedArray(data.buffer),data.width,data.height,data.options,(label,progress)=>self.postMessage({label,progress}));
    self.postMessage({puzzle});
  } catch(error) { self.postMessage({error:error.message || 'This picture could not be converted.'}); }
};
