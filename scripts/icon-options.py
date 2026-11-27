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
    ('A', 'Forest original', '#08231E', ['#12CBD1', '#55E8DB', '#8D67E8']),
    ('B', 'Forest mint', '#08231E', ['#73DAC2', '#BCF2DA', '#55BCA6']),
    ('C', 'Midnight rose', '#091429', ['#E65E9F', '#F8ACCD', '#BC417C']),
    ('D', 'Charcoal ivory', '#14191B', ['#DCE5DF', '#F6F7F0', '#A7BDB4']),
]
board = Image.new('RGB', (1440, 760), '#0D1518')
draw = ImageDraw.Draw(board)
font = 'C:/Windows/Fonts/segoeui.ttf'
bold = 'C:/Windows/Fonts/seguisb.ttf'
draw.text((60, 34), 'Cine music / Icon directions', font=ImageFont.truetype(bold, 34), fill='#F4F6F3')
draw.text((60, 86), 'Original emblem. Dark backgrounds. Crisp edges. No glow.', font=ImageFont.truetype(font, 21), fill='#A9BBB5')
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
    resources = root / 'android/app/src/main/res'
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
