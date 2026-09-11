"""Render the approved Blender actions; character/equipment only, no review scene FX."""
import bpy,sys,json,math,time
from pathlib import Path
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector
import argparse
parser=argparse.ArgumentParser();parser.add_argument('--source',required=True,help='Hearthkin Worker v007 directory containing source and scripts');parser.add_argument('--output',default='/private/tmp/hearthkin-game-frames');parser.add_argument('--clips',nargs='*');parser.add_argument('--force',action='store_true');args=parser.parse_args(sys.argv[sys.argv.index('--')+1:]);O=Path(args.source);sys.path.insert(0,str(O/'scripts'));D=Path(args.output);D.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(O/'source/Hearthkin_Worker_v007.blend'))
from review_scene import *
from motion_core import cargo_pose,key_pose
character=set(json.loads(scene['CharacterMeshNames']));views={'se':(-4,-6,3.2),'sw':(4,-6,3.2),'ne':(-4,6,3.2),'nw':(4,6,3.2)}
scene.render.engine='CYCLES';scene.cycles.samples=8;scene.cycles.use_denoising=True;scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.image_settings.compression=15
records=json.loads((D/'manifest.json').read_text()) if args.clips and (D/'manifest.json').exists() else []
if args.clips:records=[r for r in records if r['name'] not in args.clips]
for info in clips:
 name=info['name']
 if args.clips and name not in args.clips:continue
 count=8 if name=='Idle' or name.startswith('Hold') or name in ['WardSustain','Stunned'] else 16
 if name=='HoldSupplies':
  rig.animation_data.action=None;bpy.data.actions.remove(bpy.data.actions[info['action']]);a=bpy.data.actions.new(info['action']);a.use_fake_user=True;rig.animation_data.action=a
  for f in range(1,info['frames']+1):cargo_pose('Supplies',(f-1)/(info['frames']-1),False);key_pose(a,f)
 for view,loc in views.items():
  clip=select(name);shift=Vector((-.45,0,-.25)) if name=='Fall' else Vector((0,0,0));camera(Vector(loc)+shift,Vector((0,0,.88))+shift,2.4);width=384 if name=='Fall' else 256;scene.render.resolution_x=width;scene.render.resolution_y=320;scene.cycles.samples=8
  foot=world_to_camera_view(scene,scene.camera,Vector((0,0,0)));head=world_to_camera_view(scene,scene.camera,Vector((0,0,1.7)));pivot=[foot.x*width,(1-foot.y)*320];height=(head.y-foot.y)*320
  folder=D/name/view;folder.mkdir(parents=True,exist_ok=True);sourceframes=[]
  for i in range(count):
   phase=i/count if clip['loop'] else i/(count-1);f=1+phase*(clip['frames']-1);at(clip,int(f));scene.frame_set(int(f),subframe=f-int(f));update()
   keep=character|set(equipment.get(clip['equipment'],[]))
   if name=='PickBerries' and .34<=phase<.865:keep.update(equipment.get('PickedBerry',[]))
   for o in bpy.data.objects:
    if o.type not in ['LIGHT','CAMERA','ARMATURE']:o.hide_render=o.name not in keep
   path=folder/f'{i:03d}.png';sourceframes.append(f)
   if args.force or not path.exists():scene.render.filepath=str(path);bpy.ops.render.render(write_still=True)
  records.append({**info,'view':view,'count':count,'pivot':pivot,'scaleBase':height,'sourceframes':sourceframes});(D/'manifest.json').write_text(json.dumps(records,indent=2));print('DIRECTION_DONE',name,view,count,flush=True)
print('ALL_CHARACTER_VIEWS_DONE',flush=True)
