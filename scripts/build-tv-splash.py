"""Compose a single, hardware-decodable TV intro from the original emblem paths."""
from pathlib import Path
import ast, re, subprocess, shutil, argparse, xml.etree.ElementTree as ET
from PIL import Image, ImageDraw, ImageFont

root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--ffmpeg',default=shutil.which('ffmpeg') or str(root/'.device-test/tv-rebuild/pythonlibs/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v9.0.2.exe'))
args=parser.parse_args()
scope={'re':re}
tree=ast.parse((root/'scripts/build-pink-launcher.py').read_text())
exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='outline'],type_ignores=[]),'<original-vector>', 'exec'),scope)
vector=ET.parse(root/'mobile/public/cine-brand.svg').getroot()
shapes=[scope['outline'](p.attrib['d']) for p in vector.iter('{http://www.w3.org/2000/svg}path')]
points=[p for shape in shapes for p in shape]
left,top=min(p[0] for p in points),min(p[1] for p in points)
width,height=max(p[0] for p in points)-left,max(p[1] for p in points)-top
palettes={
 'forest':('#071F19',['#CBF595','#EDFFCB','#8CC77D'],'#EEFAEF','#9EB7AB'),
 'mint':('#F2F0EC',['#555F48','#7B8A68','#374A40'],'#272923','#656E5D'),
 'rose':('#FFF3F7',['#A82D65','#D86498','#76234B'],'#442737','#806171'),
 'ivory':('#101112',['#DADCD6','#F5F6F0','#A7BDB4'],'#F4F4F0','#A4A7A8'),
}
raw=root/'android/app/src/main/res/raw';raw.mkdir(exist_ok=True)
drawable=root/'android/app/src/main/res/drawable'
font=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',88)
small=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',36)
for slug,(background,colors,text,muted) in palettes.items():
 def frame(progress):
  image=Image.new('RGB',(2560,1440),background);draw=ImageDraw.Draw(image)
  ease=1-(1-progress)**3;zoom=.97+.03*ease
  scale=360*zoom/width
  for shape,color in zip(shapes,colors):
   draw.polygon([((x-left)*scale+1280-width*scale/2,(y-top)*scale+575-height*scale/2) for x,y in shape],fill=color)
  draw.text((1280,865),'Cine music',anchor='mm',font=font,fill=text)
  draw.text((1280,1312),"By Osborne's Digital Solutions",anchor='mm',font=small,fill=muted)
  if progress<1:image=Image.blend(Image.new('RGB',image.size,background),image,.86+.14*ease)
  return image.resize((1280,720),Image.Resampling.LANCZOS)
 frame(1).save(drawable/f'cine_tv_splash_{slug}.png')
 command=[args.ffmpeg,'-y','-loglevel','error','-f','rawvideo','-pixel_format','rgb24','-video_size','1280x720','-framerate','30','-i','pipe:0','-an','-c:v','libx264','-preset','medium','-tune','animation','-crf','18','-pix_fmt','yuv420p','-profile:v','baseline','-level','3.1','-movflags','+faststart',str(raw/f'cine_tv_intro_{slug}.mp4')]
 process=subprocess.Popen(command,stdin=subprocess.PIPE)
 for index in range(26):process.stdin.write(frame(index/25).tobytes())
 process.stdin.close()
 if process.wait()!=0:raise RuntimeError('TV intro encoding failed')
print('Created four TV intro movies and matching static fallbacks.')
