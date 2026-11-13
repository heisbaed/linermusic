"""Render the dark-green glowing Cine launcher artwork with Pillow.

Run from any directory: python scripts/build-green-launcher.py
"""
from pathlib import Path
import re
import xml.etree.ElementTree as ET
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
RES = ROOT / 'android/app/src/main/res'
ANDROID = '{http://schemas.android.com/apk/res/android}'
VECTOR = ET.parse(RES / 'drawable/ic_cine_launcher_foreground.xml').getroot()

BACKGROUND = (4, 12, 8, 255)
GLOW = (16, 185, 129)
GRADIENT_TOP = (110, 231, 183)
GRADIENT_BOTTOM = (4, 120, 87)


def outline(data):
    """Flatten the absolute M/L/H/V/C/Q/Z curves used by this approved artwork."""
    tokens = re.findall(r'[MLHVCQZ]|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?', data)
    points = []
    at, command = 0, ''

    def number():
        nonlocal at
        value = float(tokens[at])
        at += 1
        return value

    while at < len(tokens):
        if tokens[at] in ('M', 'L', 'H', 'V', 'C', 'Q', 'Z'):
            command = tokens[at]
            at += 1
        if command == 'Z':
            continue
        if command in ('M', 'L'):
            points.append((number(), number()))
            command = 'L'
        elif command == 'H':
            points.append((number(), points[-1][1]))
        elif command == 'V':
            points.append((points[-1][0], number()))
        elif command in ('C', 'Q'):
            controls = [points[-1]] + [(number(), number()) for _ in range(3 if command == 'C' else 2)]
            for step in range(1, 65):
                t = step / 64
                curve = controls[:]
                while len(curve) > 1:
                    curve = [((1-t)*a[0]+t*b[0], (1-t)*a[1]+t*b[1]) for a, b in zip(curve, curve[1:])]
                points.append(curve[0])
        else:
            raise ValueError(f'Unsupported path command: {command}')
    return points


paths = [outline(path.attrib[ANDROID+'pathData']) for path in VECTOR.iter('path')]
all_points = [point for points in paths for point in points]
left, top = min(p[0] for p in all_points), min(p[1] for p in all_points)
width = max(p[0] for p in all_points) - left
height = max(p[1] for p in all_points) - top


def gradient(size):
    image = Image.new('RGBA', (size, size))
    pixels = image.load()
    for y in range(size):
        blend = y / max(1, size - 1)
        color = tuple(round(GRADIENT_TOP[i] * (1 - blend) + GRADIENT_BOTTOM[i] * blend) for i in range(3))
        for x in range(size):
            pixels[x, y] = (*color, 255)
    return image


def render(size, round_icon=False):
    scale = 4
    n = size * scale
    image = Image.new('RGBA', (n, n), BACKGROUND)
    halo = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    halo_draw = ImageDraw.Draw(halo)
    halo_draw.ellipse((n*.08, n*.04, n*.92, n*.96), fill=(*GLOW, 120))
    image = Image.alpha_composite(image, halo.filter(ImageFilter.GaussianBlur(n*.17)))
    factor = n * .68 / width
    dx, dy = (n-width*factor)/2, (n-height*factor)/2
    mask = Image.new('L', (n, n), 0)
    mask_draw = ImageDraw.Draw(mask)
    scaled = [[((x-left)*factor+dx, (y-top)*factor+dy) for x, y in points] for points in paths]
    for shape in scaled:
        mask_draw.polygon(shape, fill=255)
    logo = gradient(n)
    logo.putalpha(mask)
    glow = logo.filter(ImageFilter.GaussianBlur(n*.04))
    image = Image.alpha_composite(image, glow)
    image = Image.alpha_composite(image, glow)
    image = Image.alpha_composite(image, logo)
    mask = Image.new('L', (n, n))
    mask_draw = ImageDraw.Draw(mask)
    if round_icon:
        mask_draw.ellipse((0, 0, n-1, n-1), fill=255)
    else:
        mask_draw.rounded_rectangle((0, 0, n-1, n-1), radius=n*.23, fill=255)
    image.putalpha(mask)
    return image.resize((size, size), Image.Resampling.LANCZOS)


icon = render(1024)
icon.resize((512, 512), Image.Resampling.LANCZOS).save(ROOT / 'mobile/public/cine-icon.png')
icon.resize((512, 512), Image.Resampling.LANCZOS).save(ROOT / 'android/app/src/main/assets/cine-icon.png')
icon.resize((512, 512), Image.Resampling.LANCZOS).save(RES / 'drawable/cine_icon.png')
icon.save(ROOT / 'landing page web/public/assets/cine-music-logo.png')
icon.resize((96, 96), Image.Resampling.LANCZOS).save(ROOT / 'landing page web/public/favicon.png')
for density, size in [('ldpi',36), ('mdpi',48), ('hdpi',72), ('xhdpi',96), ('xxhdpi',144), ('xxxhdpi',192)]:
    for rounded, suffix in [(False,''), (True,'_round')]:
        render(size, rounded).save(RES / f'mipmap-{density}/ic_cine_launcher{suffix}.png')
print('Updated dark-green launcher artwork for web, Android assets and all densities.')
