from pathlib import Path
import json,shutil
from PIL import Image
b=Path(__file__).resolve().parents[1]
for p in sorted((b/'provenance').glob('ashen-*.json'),key=lambda p:('final' in p.name,p.name)):
 d=json.loads(p.read_text());im=Image.open(d['output']);key=p.stem.removeprefix('ashen-').removeprefix('final-')
 if im.mode=='RGBA':shutil.copy2(d['output'],b/'assets'/(key+'.png'))
 else:
  if not (b/'assets'/(key+'.png')).exists():print('Needs alpha',key)
print('Saved',len(list((b/'assets').glob('*.png'))))
