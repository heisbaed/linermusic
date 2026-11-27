"""Render sharp launcher concepts from the existing vector geometry, without glow."""
from pathlib import Path
import ast
import xml.etree.ElementTree as ET
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[1]
out = root / 'design/icon-options'
out.mkdir(parents=True, exist_ok=True)
# Reuse only the vector path flattener; importing the launcher script would overwrite app assets.
tree = ast.parse((root / 'scripts/build-pink-launcher.py').read_text())
scope = {}
import re
scope['re'] = re
exec(compile(ast.Module(body=[node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == 'outline'], type_ignores=[]), '<vector-paths>', 'exec'), scope)
vector = ET.parse(root / 'mobile/public/cine-brand.svg').getroot()
shapes = [scope['outline'](p.attrib['d']) for p in vector.iter('{http://www.w3.org/2000/svg}path')]
points = [p for shape in shapes for p in shape]
left, top = min(p[0] for p in points), min(p[1] for p in points)
width, height = max(p[0] for p in points)-left, max(p[1] for p in points)-top
concepts = [
    ('A', 'Dark green', '#071F19', ['#CBF595', '#EDFFCB', '#8CC77D']),
    ('B', 'Smoke white', '#F2F0EC', ['#555F48', '#7B8A68', '#374A40']),
    ('C', 'Pink glass', '#FFF3F7', ['#A82D65', '#D86498', '#76234B']),
    ('D', 'Dark', '#101112', ['#DADCD6', '#F5F6F0', '#A7BDB4']),
]
board = Image.new('RGB', (1440, 760), '#0D1518')
draw = ImageDraw.Draw(board)
font = 'C:/Windows/Fonts/segoeui.ttf'
bold = 'C:/Windows/Fonts/seguisb.ttf'
draw.text((60, 34), 'Cine music / Icon directions', font=ImageFont.truetype(bold, 34), fill='#F4F6F3')
draw.text((60, 86), 'Original emblem. Matching app themes. Crisp edges. No glow.', font=ImageFont.truetype(font, 21), fill='#A9BBB5')
for i, (key, title, background, colors) in enumerate(concepts):
    n, supersample = 1024, 2
    image = Image.new('RGB', (n*supersample, n*supersample), background)
    painter = ImageDraw.Draw(image)
    scale = n*supersample*.64 / width
    dx, dy = (n*supersample-width*scale)/2, (n*supersample-height*scale)/2
    for shape, color in zip(shapes, colors):
        painter.polygon([((x-left)*scale+dx,(y-top)*scale+dy) for x,y in shape], fill=color)
    image = image.resize((n,n), Image.Resampling.LANCZOS)
    image.save(out / f'{key}.png')
    slug = ['forest', 'mint', 'rose', 'ivory'][i]
    public = root / 'mobile/public/app-icons'
    public.mkdir(parents=True, exist_ok=True)
    image.resize((256,256), Image.Resampling.LANCZOS).save(public / f'{slug}.png')
    logo = ET.Element('svg', {'xmlns':'http://www.w3.org/2000/svg','viewBox':'0 0 1200 1200'})
    logo_group = ET.SubElement(logo,'g',{'transform':f'translate({(1200-width)/2-left} {(1200-height)/2-top})'})
    for path, color in zip(vector.iter('{http://www.w3.org/2000/svg}path'), colors):
        ET.SubElement(logo_group,'path',{'d':path.attrib['d'],'fill':color})
    ET.ElementTree(logo).write(public / f'{slug}.svg',encoding='utf-8',xml_declaration=True)
    resources = root / 'android/app/src/main/res'
    banner = Image.new('RGB',(640,360),background)
    banner.paste(image.resize((196,196),Image.Resampling.LANCZOS),(24,82))
    banner_draw = ImageDraw.Draw(banner)
    banner_draw.text((226,137),'Cine music',font=ImageFont.truetype(bold,58),fill=colors[0])
    banner.save(resources / f'drawable/cine_tv_banner_{slug}.png')
    for density, size in [('ldpi',36),('mdpi',48),('hdpi',72),('xhdpi',96),('xxhdpi',144),('xxxhdpi',192)]:
        image.resize((size,size),Image.Resampling.LANCZOS).save(resources / f'mipmap-{density}/ic_cine_{slug}.png')
    android = 'http://schemas.android.com/apk/res/android'
    ET.register_namespace('android',android)
    foreground = ET.Element('vector', {f'{{{android}}}width':'108dp', f'{{{android}}}height':'108dp', f'{{{android}}}viewportWidth':'1200', f'{{{android}}}viewportHeight':'1200'})
    factor = 1200*.64/width
    group = ET.SubElement(foreground,'group',{f'{{{android}}}scaleX':str(factor),f'{{{android}}}scaleY':str(factor),f'{{{android}}}translateX':str((1200-width*factor)/2-left*factor),f'{{{android}}}translateY':str((1200-height*factor)/2-top*factor)})
    for path, color in zip(vector.iter('{http://www.w3.org/2000/svg}path'),colors):
        ET.SubElement(group,'path',{f'{{{android}}}pathData':path.attrib['d'], f'{{{android}}}fillColor':color})
    ET.ElementTree(foreground).write(resources/f'drawable/cine_icon_{slug}.xml',encoding='utf-8',xml_declaration=True)
    (resources/f'drawable/cine_icon_{slug}_background.xml').write_text(f'<shape xmlns:android="{android}"><solid android:color="{background}"/></shape>')
    (resources/f'mipmap-anydpi-v26/ic_cine_{slug}.xml').write_text(f'<adaptive-icon xmlns:android="{android}"><background android:drawable="@drawable/cine_icon_{slug}_background"/><foreground android:drawable="@drawable/cine_icon_{slug}"/></adaptive-icon>')
    x = 60 + i*345
    tile = image.resize((286,286), Image.Resampling.LANCZOS)
    mask = Image.new('L', tile.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0,0,285,285), radius=62, fill=255)
    board.paste(tile, (x,180), mask)
    draw.text((x,488), f'{key}  {title}', font=ImageFont.truetype(bold,24), fill='#F4F6F3')
    draw.text((x,530), 'Launcher size', font=ImageFont.truetype(font,17), fill='#A9BBB5')
    board.paste(image.resize((56,56),Image.Resampling.LANCZOS), (x,568))
    draw.text((x,663), background, font=ImageFont.truetype(font,18), fill='#A9BBB5')
board.save(out / 'Cine-music-icon-options.png')
print(out / 'Cine-music-icon-options.png')
