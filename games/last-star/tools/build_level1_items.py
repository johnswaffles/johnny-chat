# Run with Blender --background --python tools/build_level1_items.py
import bpy, math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'assets/level1-items';OUT.mkdir(parents=True,exist_ok=True)
def material(name,color,metal=0,emit=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=.32
 p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emit
 return m
def mesh(kind,loc,scale,mat,rot=(0,0,0)):
 if kind=='cube':bpy.ops.mesh.primitive_cube_add(size=1,location=loc)
 elif kind=='sphere':bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,radius=.5,location=loc)
 elif kind=='gem':bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.5,location=loc)
 else:bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=.5,depth=1,location=loc)
 o=bpy.context.object;o.scale=scale;o.rotation_euler=rot;o.data.materials.append(mat)
 if kind=='cube':mod=o.modifiers.new('Soft crafted edges','BEVEL');mod.width=.06;mod.segments=3;o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
 return o
for name in ['ember','frost','chain','flask','chest','power','gem','gold']:
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 gold=material('Old brass',(.72,.43,.12),.8);wood=material('Nightwood',(.07,.035,.025));paper=material('Parchment',(.8,.65,.36));colors={'ember':(1,.18,.035),'frost':(.18,.75,1),'chain':(.58,.24,1),'flask':(.04,.64,.3),'power':(.2,.65,1),'gem':(.68,.08,.7),'gold':(1,.57,.12)};magic=material('Magic',colors.get(name,(.2,.5,.8)),.3,.6)
 if name in ['ember','frost','chain']:
  mesh('cube',(0,0,0),(1.15,.13,1.1),paper)
  for z in [-.55,.55]:mesh('cylinder',(0,0,z),(.2,.2,1.45),gold,(0,math.pi/2,0))
  mesh('gem',(0,-.16,0),(.62,.22,.7),magic)
 elif name=='flask':
  mesh('sphere',(0,0,-.1),(1.1,.8,1.1),magic);mesh('cylinder',(0,0,.46),(.38,.38,.5),gold);mesh('cube',(0,0,.77),(.35,.35,.18),wood);mesh('gem',(0,-.38,-.1),(.3,.15,.35),gold)
 elif name=='chest':
  mesh('cube',(0,0,-.15),(1.7,1,.75),wood);mesh('cube',(0,0,.4),(1.75,1.05,.38),wood)
  for x in [-.62,.62]:mesh('cube',(x,-.015,.06),(.13,1.08,1.14),gold)
  mesh('cube',(0,-.57,.12),(.28,.1,.37),gold);mesh('gem',(0,-.64,.16),(.15,.08,.2),magic)
 else:
  mesh('gem' if name!='gold' else 'cylinder',(0,0,0),(.9,.6,1.4) if name!='gold' else (1.15,1.15,.2),magic,(math.pi/2,0,.15) if name=='gold' else (0,0,0))
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
 scene.render.resolution_x=256;scene.render.resolution_y=256;scene.render.resolution_percentage=100;scene.render.film_transparent=True
 bpy.ops.object.camera_add(location=(2,-6,2.3));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,0))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=2.8;scene.camera=cam
 for loc,energy,size,color in [((1,-4,5),500,4,(.65,.8,1)),((-3,-1,1),300,3,(1,.68,.3)),((0,2,3),600,2,(.3,.6,1))]:
  bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=energy;o.data.shape='DISK';o.data.size=size;o.data.color=color;o.rotation_euler=(-o.location).to_track_quat('-Z','Y').to_euler()
 scene.world.color=(.12,.12,.12);scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.filepath=str(OUT/(name+'.png'));bpy.ops.render.render(write_still=True)
 if name=='chest':bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/level1/treasure-source.blend'))
