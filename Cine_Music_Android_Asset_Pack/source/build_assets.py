#!/usr/bin/env python3
"""Build Cine music's editable vector artwork and Android asset exports.

Requirements: Python 3, fonttools, Pillow, Inkscape, ImageMagick, FFmpeg, DejaVu fonts.
Raster exports are rendered from SVG; source vector paths remain editable.
"""
from __future__ import annotations

import concurrent.futures
import hashlib
import json
import math
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import xml.etree.ElementTree as ET

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.svgLib.path import parse_path
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
RES = ROOT / "android/res"
SVG = ROOT / "source_svg"
TMP = ROOT / ".build"
NAVY = "#061126"
ICON_BG = "#071127"
IVORY = "#F6F7FC"
INK = "#101B33"
CYAN = "#00D9F2"
BLUE = "#2477FF"
VIOLET = "#8143FF"
MAGENTA = "#C42AF7"
ANDROID = "http://schemas.android.com/apk/res/android"
AAPT = "http://schemas.android.com/aapt"
PALETTE = {"midnight_navy": NAVY, "icon_background": ICON_BG,
           "cyan": CYAN, "blue": BLUE, "violet": VIOLET,
           "magenta": MAGENTA, "ivory": IVORY, "ink": INK}

# Production Bezier redraw of the approved C + quaver-note artwork.
# Three independent filled paths keep the ribbon and note editable.
RAW = [
    "M742 221 C589 191 423 243 302 362 C211 454 165 575 166 705 "
    "C167 902 301 1065 490 1097 C644 1127 811 1071 915 961 "
    "C954 921 971 858 951 809 C934 768 888 750 849 771 "
    "C802 793 777 850 720 859 C641 886 535 876 467 839 "
    "C397 802 363 726 384 652 C418 515 550 384 681 395 "
    "C720 401 745 405 767 393 C806 373 830 345 829 311 "
    "C827 266 798 231 742 221 Z",
    "M742 221 C589 191 423 243 302 362 C211 454 165 575 166 705 "
    "C167 902 301 1065 490 1097 C369 1038 305 923 309 789 "
    "C312 629 397 478 522 419 C575 394 629 387 681 395 "
    "C720 401 745 405 767 393 C806 373 830 345 829 311 "
    "C827 266 798 231 742 221 Z",
    "M890 320 C1025 407 1117 465 1153 546 C1191 632 1148 718 1083 746 "
    "Q1051 757 1057 727 C1064 680 1015 610 956 564 L956 831 "
    "C956 930 869 1017 782 1019 C688 1025 615 960 616 875 "
    "C617 786 690 712 784 695 C817 688 847 688 871 697 L871 337 "
    "Q871 308 890 320 Z",
]

def transformed(d, matrix):
    pen = SVGPathPen(None)
    parse_path(d, TransformPen(pen, matrix))
    return pen.getCommands()

def bounds(ds):
    pen = BoundsPen(None)
    for d in ds:
        parse_path(d, pen)
    return pen.bounds

BX0, BY0, BX1, BY1 = bounds(RAW)
FACTOR = 1000 / (BX1 - BX0)
PATHS = [transformed(d, (FACTOR, 0, 0, FACTOR, -BX0*FACTOR, -BY0*FACTOR)) for d in RAW]
MARK_H = (BY1 - BY0) * FACTOR

def xy(x, y):
    return ((x - BX0) * FACTOR, (y - BY0) * FACTOR)

GRADIENTS = [
    (xy(330, 450), xy(760, 1110), [(0, "#00CFF0"), (.39, "#147DFF"), (.75, "#553BFF"), (1, "#9234F7")]),
    (xy(420, 270), xy(430, 1120), [(0, "#00E7EA"), (.47, "#00C4F2"), (1, "#2477FF")]),
    (xy(830, 410), xy(850, 1030), [(0, "#02CCF0"), (.42, "#4282F9"), (.77, "#9050FA"), (1, "#BC2AF2")]),
]

def gradient_defs(prefix="cine"):
    result = []
    for i, ((x1, y1), (x2, y2), stops) in enumerate(GRADIENTS):
        result.append(f'<linearGradient id="{prefix}{i}" gradientUnits="userSpaceOnUse" x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}">')
        result.extend(f'<stop offset="{o}" stop-color="{c}"/>' for o, c in stops)
        result.append('</linearGradient>')
    return ''.join(result)

def mark(x=0, y=0, width=1000, color=None, opacity=1, prefix="cine"):
    return (f'<g transform="translate({x} {y}) scale({width/1000})" opacity="{opacity}">'
            + ''.join(f'<path d="{d}" fill="{color or f"url(#{prefix}{i})"}"/>' for i, d in enumerate(PATHS)) + '</g>')

FONT_BASE = Path('/usr/share/fonts/truetype/dejavu')
FONT_BOLD = FONT_BASE / 'DejaVuSans-Bold.ttf'
FONT_LIGHT = FONT_BASE / 'DejaVuSans-ExtraLight.ttf'
if not FONT_LIGHT.exists():
    FONT_LIGHT = FONT_BASE / 'DejaVuSans.ttf'

def glyph_paths(text, font_path, size, x, baseline):
    font = TTFont(font_path)
    glyphset = font.getGlyphSet()
    cmap = font.getBestCmap()
    scale = size / font['head'].unitsPerEm
    paths = []
    prev = None
    kern = font['kern'].kernTables[0].kernTable if 'kern' in font else {}
    for character in text:
        name = cmap[ord(character)]
        x += kern.get((prev, name), 0) * scale if prev else 0
        pen = SVGPathPen(glyphset)
        glyphset[name].draw(TransformPen(pen, (scale, 0, 0, -scale, x, baseline)))
        paths.append(pen.getCommands())
        x += glyphset[name].width * scale
        prev = name
    font.close()
    return paths, x

wp1, word_x = glyph_paths('Cine', FONT_BOLD, 180, 0, 190)
wp2, _ = glyph_paths('music', FONT_LIGHT, 180, word_x+31, 190)
word_raw = [d for d in wp1+wp2 if d]
WX0, WY0, WX1, WY1 = bounds(word_raw)
WS = 1000/(WX1-WX0)
WORD_PATHS = [transformed(d, (WS, 0, 0, WS, -WX0*WS, -WY0*WS)) for d in word_raw]
WORD_H = (WY1-WY0)*WS

def wordmark(x, y, width, color=IVORY):
    return f'<g transform="translate({x} {y}) scale({width/1000})" fill="{color}">' + ''.join(f'<path d="{d}"/>' for d in WORD_PATHS) + '</g>'

def text(x, y, content, size=24, fill=IVORY, weight=400, spacing=0):
    from xml.sax.saxutils import escape
    return f'<text x="{x}" y="{y}" fill="{fill}" font-family="DejaVu Sans,sans-serif" font-size="{size}" font-weight="{weight}" letter-spacing="{spacing}">{escape(content)}</text>'

def svg_doc(width, height, body, extra_defs="", background=None):
    bg = f'<rect width="{width}" height="{height}" fill="{background}"/>' if background else ''
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">'
            '<title>Cine music</title><desc>Cine music Android brand artwork. Editable vector paths.</desc>'
            f'<defs>{gradient_defs()}{extra_defs}</defs>{bg}{body}</svg>')

def write(path, content):
    path = ROOT / path if not isinstance(path, Path) else path
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding='utf-8')
    return path

def svg_asset(name, width, height, body, extra_defs="", background=None):
    return write(SVG/name, svg_doc(width, height, body, extra_defs, background))

def icon_body(size=1024, shape='square'):
    if shape == 'round':
        bg = f'<circle cx="{size/2}" cy="{size/2}" r="{size/2}" fill="{ICON_BG}"/>'
    else:
        r = size*.23 if shape == 'rounded' else 0
        bg = f'<rect width="{size}" height="{size}" rx="{r}" fill="{ICON_BG}"/>'
    w = size*.705
    return bg + mark((size-w)/2, (size-MARK_H*w/1000)/2, w)

# All playback and navigation controls are original, simple 24-unit paths.
# Tuple: (SVG/Android path data, filled silhouette or rounded outline).
UI = {
 'play': [('M8 5.5 Q8 4.5 9 5.1 L18.5 11.3 Q19.5 12 18.5 12.7 L9 18.9 Q8 19.5 8 18.5 Z', True)],
 'pause': [('M7 4 H9 Q10 4 10 5 V19 Q10 20 9 20 H7 Q6 20 6 19 V5 Q6 4 7 4 Z M15 4 H17 Q18 4 18 5 V19 Q18 20 17 20 H15 Q14 20 14 19 V5 Q14 4 15 4 Z', True)],
 'next': [('M5 5 L15 12 L5 19 Z', True), ('M18 5 V19', False)],
 'previous': [('M19 5 L9 12 L19 19 Z', True), ('M6 5 V19', False)],
 'stop': [('M6 5 H18 Q19 5 19 6 V18 Q19 19 18 19 H6 Q5 19 5 18 V6 Q5 5 6 5 Z', True)],
 'shuffle': [('M3 6 H5 C10 6 11 18 16 18 H21 M18 15 L21 18 L18 21 M3 18 H5 C10 18 11 6 16 6 H21 M18 3 L21 6 L18 9', False)],
 'repeat': [('M4 8 H18 L15 5 M18 8 L15 11 M20 16 H6 L9 19 M6 16 L9 13 M4 8 V12 M20 16 V12', False)],
 'repeat_one': [('M4 8 H18 L15 5 M18 8 L15 11 M20 16 H6 L9 19 M6 16 L9 13 M4 8 V12 M20 16 V12 M11 10 L12 9 V15', False)],
 'volume': [('M3 9 H7 L11 5 V19 L7 15 H3 Z M15 8 C18 10 18 14 15 16 M18 5 C23 9 23 15 18 19', False)],
 'mute': [('M3 9 H7 L11 5 V19 L7 15 H3 Z M16 9 L22 15 M22 9 L16 15', False)],
 'music': [('M10 17 V5 L20 3 V15 M10 8 L20 6 M10 17 C10 20 4 21 4 18 C4 15 10 14 10 17 Z M20 15 C20 18 14 19 14 16 C14 13 20 12 20 15 Z', False)],
 'library': [('M4 4 V20 M9 4 V20 M14 4 V20 M18 5 L22 19', False)],
 'album': [('M12 3 A9 9 0 1 1 12 21 A9 9 0 1 1 12 3 Z M12 9 A3 3 0 1 1 12 15 A3 3 0 1 1 12 9 Z', False)],
 'artist': [('M12 3 A4 4 0 1 1 12 11 A4 4 0 1 1 12 3 Z M4 21 V19 C4 12 20 12 20 19 V21', False)],
 'playlist': [('M3 6 H15 M3 11 H13 M3 16 H10 M17 18 V10 L22 9 M17 18 C17 21 11 22 11 19 C11 16 17 15 17 18 Z', False)],
 'heart': [('M12 21 L3.5 12.5 C-2 6.5 7 0 12 7 C17 0 26 6.5 20.5 12.5 Z', False)],
 'heart_filled': [('M12 21 L3.5 12.5 C-2 6.5 7 0 12 7 C17 0 26 6.5 20.5 12.5 Z', True)],
 'search': [('M10.5 3 A7.5 7.5 0 1 1 10.5 18 A7.5 7.5 0 1 1 10.5 3 Z M16 16 L22 22', False)],
 'home': [('M3 10 L12 3 L21 10 V21 H15 V14 H9 V21 H3 Z', False)],
 'download': [('M12 3 V16 M7 11 L12 16 L17 11 M4 17 V21 H20 V17', False)],
 'add': [('M12 5 V19 M5 12 H19', False)],
 'more': [('M5 11 A1 1 0 1 1 5 13 A1 1 0 1 1 5 11 Z M12 11 A1 1 0 1 1 12 13 A1 1 0 1 1 12 11 Z M19 11 A1 1 0 1 1 19 13 A1 1 0 1 1 19 11 Z', True)],
 'close': [('M5 5 L19 19 M19 5 L5 19', False)],
 'back': [('M20 12 H4 M10 6 L4 12 L10 18', False)],
 'settings': [('M4 6 H20 M4 12 H20 M4 18 H20 M8 3 V9 M16 9 V15 M10 15 V21', False)],
 'headphones': [('M3 14 V12 A9 9 0 0 1 21 12 V14 M3 12 H5 Q7 12 7 14 V19 Q7 21 5 21 H3 Z M21 12 H19 Q17 12 17 14 V19 Q17 21 19 21 H21 Z', False)],
 'equalizer': [('M4 9 V15 M8 4 V20 M12 7 V17 M16 3 V21 M20 9 V15', False)],
 'moon': [('M20 15.5 A8.5 8.5 0 1 1 8.5 4 A7 7 0 0 0 20 15.5 Z', False)],
 'share': [('M18 3 A3 3 0 1 1 18 9 A3 3 0 1 1 18 3 Z M6 9 A3 3 0 1 1 6 15 A3 3 0 1 1 6 9 Z M18 15 A3 3 0 1 1 18 21 A3 3 0 1 1 18 15 Z M8.7 10.5 L15.3 7.5 M8.7 13.5 L15.3 16.5', False)],
 'queue': [('M3 5 H21 M3 10 H21 M3 15 H12 M3 20 H12', False), ('M17 14 L23 18 L17 22 Z', True)],
 'chevron_down': [('M5 9 L12 16 L19 9', False)],
 'timer': [('M9 2 H15 M12 5 V7 M18 5 L20 7 M12 7 A8 8 0 1 1 12 23 A8 8 0 1 1 12 7 Z M12 10 V15 L15 17', False)],
}

def ui_body(name, color=IVORY):
    return ''.join((f'<path d="{d}" fill="{color}"/>' if filled else f'<path d="{d}" fill="none" stroke="{color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>') for d, filled in UI[name])

def placeholder_body(kind, theme, size=1024):
    dark = theme == 'dark'
    bg = '#0D1D39' if dark else '#E9EDF9'
    stroke = '#203B61' if dark else '#CBD4ED'
    body = f'<rect width="{size}" height="{size}" fill="{bg}"/>'
    body += f'<circle cx="{size/2}" cy="{size/2}" r="{size*.34}" fill="none" stroke="{stroke}" stroke-width="2"/>'
    body += f'<circle cx="{size/2}" cy="{size/2}" r="{size*.41}" fill="none" stroke="{stroke}" stroke-width="1"/>'
    if kind == 'album':
        w=size*.43
        body += mark((size-w)/2,(size-MARK_H*w/1000)/2,w)
    else:
        ui_name = {'song':'music','artist':'artist','playlist':'playlist','favorites':'heart'}[kind]
        body += f'<g transform="translate({size*.31} {size*.31}) scale({size*.38/24})">{ui_body(ui_name, CYAN if dark else "#5566D6")}</g>'
    return body

def native_vector(paths, width=24, height=24, vw=24, vh=24, tint=None, group=None, gradients=False):
    root = f'<vector xmlns:android="{ANDROID}" xmlns:aapt="{AAPT}" android:width="{width}dp" android:height="{height}dp" android:viewportWidth="{vw}" android:viewportHeight="{vh}"'
    if tint:
        root += f' android:tint="{tint}"'
    root += '>'
    if group:
        root += '<group ' + ' '.join(f'android:{k}="{v}"' for k,v in group.items()) + '>'
    for i, item in enumerate(paths):
        if isinstance(item, str):
            d, filled, color = item, True, '#FFFFFFFF'
        else:
            d, filled, color = item
        if gradients:
            (x1,y1),(x2,y2),stops = GRADIENTS[i]
            root += f'<path android:name="cine_path_{i}" android:pathData="{d}"><aapt:attr name="android:fillColor"><gradient android:type="linear" android:startX="{x1}" android:startY="{y1}" android:endX="{x2}" android:endY="{y2}">'
            root += ''.join(f'<item android:offset="{o}" android:color="{c}"/>' for o,c in stops)
            root += '</gradient></aapt:attr></path>'
        elif filled:
            root += f'<path android:pathData="{d}" android:fillColor="{color}"/>'
        else:
            root += f'<path android:pathData="{d}" android:fillColor="#00000000" android:strokeColor="{color}" android:strokeWidth="1.8" android:strokeLineCap="round" android:strokeLineJoin="round"/>'
    if group:
        root += '</group>'
    return '<?xml version="1.0" encoding="utf-8"?>\n' + root + '</vector>\n'

def native_mark(name, canvas, width, colored=True, tint=None):
    group={'translateX': (canvas-width)/2, 'translateY': (canvas-MARK_H*width/1000)/2, 'scaleX':width/1000, 'scaleY':width/1000}
    if colored:
        write(RES/'drawable-v24'/f'{name}.xml', native_vector(PATHS,canvas,canvas,canvas,canvas,group=group,gradients=True))
        colors=[BLUE,CYAN,VIOLET]
        write(RES/'drawable'/f'{name}.xml', native_vector([(d,True,c) for d,c in zip(PATHS,colors)],canvas,canvas,canvas,canvas,group=group))
    else:
        write(RES/'drawable'/f'{name}.xml', native_vector(PATHS,canvas,canvas,canvas,canvas,tint=tint,group=group))

def native_word(name, color, canvas_w=200, canvas_h=80, width=180):
    paths=[(d,True,color) for d in WORD_PATHS]
    group={'translateX':(canvas_w-width)/2,'translateY':(canvas_h-WORD_H*width/1000)/2,'scaleX':width/1000,'scaleY':width/1000}
    write(RES/'drawable'/f'{name}.xml',native_vector(paths,canvas_w,canvas_h,canvas_w,canvas_h,group=group))

RENDER_JOBS=[]
def queue_render(source, dest, width=None, height=None, opaque=False, square32=False):
    RENDER_JOBS.append((source, ROOT/dest, width, height, opaque, square32))

def render_job(job):
    source,dest,width,height,opaque,square32=job
    dest.parent.mkdir(parents=True,exist_ok=True)
    staging=dest.with_name(dest.stem+'.render.png')
    final=dest.with_name(dest.stem+'.final.png')
    cmd=['inkscape',str(source),'--export-type=png',f'--export-filename={staging}']
    if width:
        cmd.append(f'--export-width={width}')
    if height:
        cmd.append(f'--export-height={height}')
    result=subprocess.run(cmd,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    if result.returncode:
        raise RuntimeError(f'Render failed: {dest.name}: {result.stderr[-800:]}')
    if opaque:
        subprocess.run(['convert',str(staging),'-background',NAVY,'-alpha','remove','-alpha','off',f'PNG24:{final}'],check=True)
    elif square32:
        subprocess.run(['convert',str(staging),f'PNG32:{final}'],check=True)
    else:
        final=staging
    from PIL import Image
    with Image.open(final) as im:
        im.verify()
    os.replace(final,dest)
    if staging.exists():
        staging.unlink()
    return str(dest.relative_to(ROOT))

def build_sources():
    for variant,color in [('gradient',None),('white',IVORY),('black',INK),('cyan',CYAN)]:
        source=svg_asset(f'cine_symbol_{variant}.svg',1200,1200,mark(100,(1200-MARK_H)/2,1000,color))
        for size in [2048,1024,512,256]:
            queue_render(source,f'logos/png/cine_symbol_{variant}_{size}.png',size)
    for theme,ink in [('dark',IVORY),('light',INK)]:
        horizontal=svg_asset(f'cine_logo_horizontal_{theme}.svg',2200,600,
              mark(60,(600-MARK_H*.48)/2,480)+wordmark(640,(600-WORD_H*1.5)/2,1500,ink))
        stacked=svg_asset(f'cine_logo_stacked_{theme}.svg',1400,1500,
              mark(250,90,900)+wordmark(100,1120,1200,ink))
        word=svg_asset(f'cine_wordmark_{theme}.svg',1400,400,
              wordmark(100,(400-WORD_H*1.2)/2,1200,ink))
        for width in [2200,1100]:
            queue_render(horizontal,f'logos/png/cine_logo_horizontal_{theme}_{width}.png',width)
        for width in [1400,700]:
            queue_render(stacked,f'logos/png/cine_logo_stacked_{theme}_{width}.png',width)
        queue_render(word,f'logos/png/cine_wordmark_{theme}_1400.png',1400)
    for variant,color in [('white',IVORY),('black',INK)]:
        horizontal=svg_asset(f'cine_logo_horizontal_{variant}.svg',2200,600,
              mark(60,(600-MARK_H*.48)/2,480,color)+wordmark(640,(600-WORD_H*1.5)/2,1500,color))
        queue_render(horizontal,f'logos/png/cine_logo_horizontal_{variant}_2200.png',2200)
    for shape in ['square','rounded','round']:
        source=svg_asset(f'cine_app_icon_{shape}.svg',1024,1024,icon_body(1024,shape))
        for size in [1024,512,256,128]:
            queue_render(source,f'icons/cine_app_icon_{shape}_{size}.png',size,square32=True)
    fg=svg_asset('cine_adaptive_foreground.svg',1080,1080,mark(250,(1080-MARK_H*.58)/2,580))
    mono=svg_asset('cine_adaptive_monochrome.svg',1080,1080,mark(250,(1080-MARK_H*.58)/2,580,IVORY))
    bg=svg_asset('cine_adaptive_background.svg',1080,1080,'',background=ICON_BG)
    for density,scale in [('ldpi',.75),('mdpi',1),('hdpi',1.5),('xhdpi',2),('xxhdpi',3),('xxxhdpi',4)]:
        legacy=int(48*scale)
        adaptive=int(108*scale)
        queue_render(SVG/'cine_app_icon_rounded.svg',f'android/res/mipmap-{density}/ic_cine_launcher.png',legacy)
        queue_render(SVG/'cine_app_icon_round.svg',f'android/res/mipmap-{density}/ic_cine_launcher_round.png',legacy)
        for layer,source in [('foreground',fg),('background',bg),('monochrome',mono)]:
            queue_render(source,f'icons/adaptive_png/{density}/cine_{layer}.png',adaptive)
    queue_render(SVG/'cine_app_icon_square.svg','store/cine_music_play_store_icon_512.png',512,square32=True)

def build_ui():
    for name in UI:
        source=write(ROOT/'ui_icons/svg'/f'cine_{name}.svg',svg_doc(24,24,ui_body(name)))
        for size in [24,48,96]:
            queue_render(source,f'ui_icons/png/{size}/cine_{name}.png',size)
        paths=[(d,filled,'#FFFFFFFF') for d,filled in UI[name]]
        write(RES/'drawable'/f'ic_cine_{name}.xml',native_vector(paths,tint='@color/cine_on_background'))
    # Notifications use an un-tinted, opaque white silhouette with transparent surroundings.
    native_mark('ic_cine_notification',24,20,colored=False)
    source=svg_asset('cine_notification.svg',24,24,mark(2,(24-MARK_H*.02)/2,20,'#FFFFFF'))
    for density,scale in [('ldpi',.75),('mdpi',1),('hdpi',1.5),('xhdpi',2),('xxhdpi',3),('xxxhdpi',4)]:
        queue_render(source,f'icons/notification/{density}/ic_cine_notification.png',int(24*scale))
    native_mark('ic_cine_shortcut_music',48,36,colored=True)

def build_placeholders():
    for kind in ['album','song','artist','playlist','favorites']:
        for theme in ['dark','light']:
            source=svg_asset(f'cine_placeholder_{kind}_{theme}.svg',1024,1024,placeholder_body(kind,theme))
            for size in [1024,512]:
                queue_render(source,f'placeholders/cine_{kind}_{theme}_{size}.png',size,opaque=True)
            folder='drawable-night-nodpi' if theme=='dark' else 'drawable-nodpi'
            queue_render(source,f'android/res/{folder}/cine_placeholder_{kind}.png',512,opaque=True)

def build_splash():
    native_mark('ic_cine_symbol',48,42,colored=True)
    native_mark('ic_cine_launcher_foreground',108,58,colored=True)
    native_mark('ic_cine_launcher_monochrome',108,58,colored=False)
    native_mark('ic_cine_splash',288,170,colored=True)
    native_word('cine_splash_branding_white',IVORY)
    native_word('cine_splash_branding_dark',INK)
    native_word('cine_wordmark', '@color/cine_on_background', 300,80,280)
    for theme,bg,ink in [('dark',NAVY,IVORY),('light',IVORY,INK)]:
        icon=svg_asset(f'cine_splash_icon_{theme}.svg',1152,1152,
              mark(236,(1152-MARK_H*.68)/2,680))
        queue_render(icon,f'splash/cine_splash_icon_{theme}_1152.png',1152)
        branding=svg_asset(f'cine_splash_branding_{theme}.svg',800,320,
              wordmark(40,(320-WORD_H*.72)/2,720,ink))
        queue_render(branding,f'splash/cine_splash_branding_{theme}_800x320.png',800)
        for width,height in [(1080,1920),(1080,2400),(1440,2560),(1920,1080)]:
            w=min(width*.42,height*.36)
            wh=min(width*.66,height*.52)
            blockh=MARK_H*w/1000+wh*WORD_H/1000+height*.04
            top=(height-blockh)/2
            body=mark((width-w)/2,top,w)+wordmark((width-wh)/2,top+MARK_H*w/1000+height*.04,wh,ink)
            source=svg_asset(f'cine_splash_{theme}_{width}x{height}.svg',width,height,body,background=bg)
            queue_render(source,f'splash/cine_splash_{theme}_{width}x{height}.png',width,opaque=True)

def build_android():
    for qualifier,monochrome in [('mipmap-anydpi-v26',False),('mipmap-anydpi-v33',True)]:
        adaptive=(f'<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="{ANDROID}">\n'
                  '  <background android:drawable="@color/cine_icon_background"/>\n'
                  '  <foreground android:drawable="@drawable/ic_cine_launcher_foreground"/>\n')
        if monochrome:
            adaptive+='  <monochrome android:drawable="@drawable/ic_cine_launcher_monochrome"/>\n'
        adaptive+='</adaptive-icon>\n'
        for name in ['ic_cine_launcher','ic_cine_launcher_round']:
            write(RES/qualifier/f'{name}.xml',adaptive)
    colors={'cine_midnight':NAVY,'cine_icon_background':ICON_BG,'cine_cyan':CYAN,'cine_blue':BLUE,
            'cine_violet':VIOLET,'cine_magenta':MAGENTA,'cine_ivory':IVORY,'cine_ink':INK,
            'cine_background':IVORY,'cine_on_background':INK}
    write(RES/'values/cine_colors.xml','<resources>\n'+''.join(f'  <color name="{n}">{v}</color>\n' for n,v in colors.items())+'</resources>\n')
    write(RES/'values-night/cine_colors.xml',f'<resources><color name="cine_background">{NAVY}</color><color name="cine_on_background">{IVORY}</color></resources>\n')
    write(RES/'values/cine_strings.xml','<resources><string name="cine_app_name">Cine music</string></resources>\n')
    def starting_style(name,background,branding=None):
        extra=(f'    <item name="android:windowSplashScreenBrandingImage">@drawable/{branding}</item>\n' if branding else '')
        return (f'  <style name="{name}" parent="Theme.SplashScreen">\n'
                f'    <item name="windowSplashScreenBackground">{background}</item>\n'
                '    <item name="windowSplashScreenAnimatedIcon">@drawable/ic_cine_splash</item>\n'
                '    <item name="postSplashScreenTheme">@style/Theme.CineMusic</item>\n'+extra+'  </style>\n')
    main=('  <style name="Theme.CineMusic" parent="android:style/Theme.Material.Light.NoActionBar">\n'
          '    <item name="android:windowBackground">@color/cine_background</item>\n'
          '    <item name="android:colorAccent">@color/cine_cyan</item>\n'
          '    <item name="android:statusBarColor">@color/cine_background</item>\n'
          '    <item name="android:navigationBarColor">@color/cine_background</item>\n'
          '    <item name="android:windowLightStatusBar">true</item>\n'
          '  </style>\n')
    dark=starting_style('Theme.CineMusic.Starting','@color/cine_midnight')
    light=starting_style('Theme.CineMusic.Starting.Light','@color/cine_ivory')
    write(RES/'values/cine_themes.xml','<resources>\n'+main+dark+light+'</resources>\n')
    write(RES/'values-v31/cine_themes.xml','<resources>\n'
          +starting_style('Theme.CineMusic.Starting','@color/cine_midnight','cine_splash_branding_white')
          +starting_style('Theme.CineMusic.Starting.Light','@color/cine_ivory','cine_splash_branding_dark')+'</resources>\n')
    main_night=main.replace('Theme.Material.Light.NoActionBar','Theme.Material.NoActionBar').replace('>true<','>false<')
    write(RES/'values-night/cine_themes.xml','<resources>\n'+main_night+'</resources>\n')
    write(RES/'layout/cine_brand_welcome.xml',f'''<?xml version="1.0" encoding="utf-8"?>
<FrameLayout xmlns:android="{ANDROID}"
    android:layout_width="match_parent" android:layout_height="match_parent"
    android:background="@color/cine_background">
    <LinearLayout android:layout_width="wrap_content" android:layout_height="wrap_content"
        android:layout_gravity="center" android:gravity="center" android:orientation="vertical">
        <ImageView android:layout_width="192dp" android:layout_height="192dp"
            android:src="@drawable/ic_cine_symbol" android:contentDescription="@null"/>
        <ImageView android:layout_width="256dp" android:layout_height="68dp"
            android:layout_marginTop="12dp" android:src="@drawable/cine_wordmark"
            android:contentDescription="@string/cine_app_name"/>
    </LinearLayout>
</FrameLayout>
''')
    write(ROOT/'android/AndroidManifest-snippet.xml',f'''<!-- Merge these attributes into your EXISTING manifest. -->
<manifest xmlns:android="{ANDROID}">
    <application android:icon="@mipmap/ic_cine_launcher"
        android:roundIcon="@mipmap/ic_cine_launcher_round"
        android:label="@string/cine_app_name" android:theme="@style/Theme.CineMusic">
        <!-- Apply the starting theme to your existing launcher activity. -->
        <activity android:name=".MainActivity" android:exported="true"
            android:theme="@style/Theme.CineMusic.Starting">
            <intent-filter>
                <action android:name="android.intent.action.MAIN"/>
                <category android:name="android.intent.category.LAUNCHER"/>
            </intent-filter>
        </activity>
    </application>
</manifest>
''')
    write(ROOT/'android/InstallSplashScreen.kt', '''// Integration example: add the import and installSplashScreen() call to your launcher activity.
// Keep your existing activity base class, content and navigation.
import android.os.Bundle
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen

// Inside your existing MainActivity:
// override fun onCreate(savedInstanceState: Bundle?) {
//     installSplashScreen()   // Must run BEFORE super.onCreate().
//     super.onCreate(savedInstanceState)
//     // Your existing setContent { ... } or setContentView(...)
// }
''')
    write(ROOT/'android/build.gradle.kts.snippet', '''// Add to your existing app module dependencies.
// Use a modern compileSdk compatible with the selected AndroidX dependency.
// Keep your project's newer compileSdk when it already has one.
dependencies {
    implementation("androidx.core:core-splashscreen:1.2.0")
}
''')

def build_store():
    defs=(f'<radialGradient id="ambient"><stop offset="0" stop-color="#192E68"/><stop offset="1" stop-color="{NAVY}"/></radialGradient>')
    body='<rect width="1024" height="500" fill="url(#ambient)"/>'
    body+='<circle cx="135" cy="250" r="230" fill="none" stroke="#243F69" stroke-width="1"/>'
    body+='<circle cx="135" cy="250" r="185" fill="none" stroke="#1B325A" stroke-width="1"/>'
    body+=mark(98,126,260)+wordmark(420,(500-WORD_H*.50)/2,500)
    source=svg_asset('cine_play_feature_graphic.svg',1024,500,body,defs)
    queue_render(source,'store/cine_music_feature_graphic_1024x500.png',1024,opaque=True)
    # Neutral reusable backdrop, without making claims about app features.
    body='<rect width="1080" height="1920" fill="url(#ambient)"/>'
    body+=mark(90,130,130)+wordmark(260,168,650)
    body+=f'<rect x="90" y="440" width="900" height="1320" rx="64" fill="none" stroke="#21345B" stroke-width="2"/>'
    source=svg_asset('cine_store_screenshot_backdrop.svg',1080,1920,body,defs)
    queue_render(source,'store/cine_screenshot_backdrop_1080x1920.png',1080,opaque=True)

def build_preview():
    defs=(f'<radialGradient id="board"><stop offset="0" stop-color="#10244D"/><stop offset="1" stop-color="{NAVY}"/></radialGradient>')
    body='<rect width="1920" height="1360" fill="url(#board)"/>'
    body+=wordmark(80,66,510)+text(1280,100,'ANDROID ASSET PACK',24,'#9EB1D4',400,4)
    body+=text(80,190,'APP ICON',22,'#A5B6D7',400,3)
    body+=f'<g transform="translate(80 225) scale({440/1024})">{icon_body(1024,"rounded")}</g>'
    body+=text(615,190,'ADAPTIVE + THEMED',22,'#A5B6D7',400,3)
    body+=f'<g transform="translate(615 245) scale({170/1024})">{icon_body(1024,"round")}</g>'
    body+='<rect x="830" y="245" width="170" height="170" rx="48" fill="#DDD7FA"/>'
    body+=mark(865,286,100,'#453078')
    body+=text(615,485,'MUSIC PLACEHOLDERS',20,'#A5B6D7',400,2)
    for i,kind in enumerate(['album','artist','playlist']):
        body+=f'<g transform="translate({615+i*145} 525) scale({120/1024})">{placeholder_body(kind,"dark")}</g>'
    body+=text(80,755,'PRIMARY LOGO',22,'#A5B6D7',400,3)
    body+=mark(80,805,190)+wordmark(320,837,750)
    body+=text(80,1070,'BRAND COLOURS',20,'#A5B6D7',400,2)
    for i,(name,color) in enumerate([('CYAN',CYAN),('BLUE',BLUE),('VIOLET',VIOLET),('IVORY',IVORY)]):
        x=80+i*245
        body+=f'<circle cx="{x+24}" cy="1125" r="24" fill="{color}"/>'
        body+=text(x+63,1119,name,16,'#A5B6D7',400,1)+text(x+63,1147,color,18)
    body+=text(80,1220,'PLAYBACK + NAVIGATION',18,'#A5B6D7',400,2)
    for i,name in enumerate(['play','pause','previous','next','shuffle','repeat','heart','search','headphones','equalizer']):
        body+=f'<g transform="translate({80+i*100} 1260) scale(1.5)">{ui_body(name)}</g>'
    body+='<rect x="1240" y="158" width="500" height="1060" rx="80" fill="#101827" stroke="#697488" stroke-width="3"/>'
    body+=f'<rect x="1254" y="172" width="472" height="1032" rx="68" fill="{NAVY}"/>'
    body+='<circle cx="1490" cy="200" r="10" fill="#020610"/>'
    body+=mark(1360,492,260)+wordmark(1318,775,344)
    body+=text(1300,1280,'SPLASH / DARK',21,'#A5B6D7',400,3)
    source=svg_asset('cine_asset_pack_overview.svg',1920,1360,body,defs)
    queue_render(source,'preview/Cine_Music_Asset_Pack_Preview.png',1920,opaque=True)

def build_docs():
    write(ROOT/'README.md', '''# Cine music — Android asset pack

The approved cyan-to-violet C + music-note identity, prepared as matching Android resources and editable artwork.

## Start here

1. Open `preview/Cine_Music_Asset_Pack_Preview.png` to see the finished kit.
2. Copy the contents of `android/res/` into your app's `app/src/main/res/` directory. Merge the prefixed values files with your existing resources when necessary.
3. Follow `android/README.md` for launcher icons, the native splash screen, and notifications.
4. Upload the two ready-sized files in `store/` for the Google Play icon and feature graphic.

## Folders

| Folder | Contents |
|---|---|
| `android/` | Adaptive and themed launcher XML, six legacy density sets, notifications, UI controls, splash themes, light/dark placeholder resources, setup snippets |
| `source_svg/` | Editable vector symbols, outlined wordmarks and logos, app icons, splash designs, placeholders and marketing artwork |
| `logos/png/` | Transparent gradient/white/black/cyan symbols and horizontal/stacked logos |
| `icons/` | Square, rounded and round icons; separate adaptive layers; notification density exports |
| `splash/` | Dark/light splash compositions, transparent native splash icon and branding exports |
| `ui_icons/` | 32 matching playback/navigation controls in SVG and transparent PNG |
| `placeholders/` | Album, song, artist, playlist and favourites artwork in light/dark variants |
| `store/` | 512 px Play icon, 1024 × 500 feature graphic, reusable screenshot backdrop |
| `documentation/` | Brand guide, asset manifest, validation report and font attribution |
| `source/` | Reproducible vector/export builder and the generation prompt record |

The screenshot backdrop is a design template. Add genuine screenshots from your app before submitting it as store screenshot material.

This is an asset pack, not an APK or a music-player implementation. Vector/XML structure and export dimensions are checked; native integration still needs a build and a launch check inside your app.

## Source artwork

The master mark is a clean, editable Bezier redraw of the approved AI-generated concept. Final PNGs and Android vector paths derive from that shared vector geometry. Logo lettering is outlined, so installing a font is unnecessary for normal use. Export tooling and attribution are in `source/` and `documentation/`.
''')
    write(ROOT/'android/README.md', '''# Android integration

## 1. Add resources

Merge `res/` into your app's `app/src/main/res/`. Resource names use `cine_` or `ic_cine_` to reduce collisions. The provided setup targets API 23 and newer. Use a modern compileSdk compatible with the selected AndroidX dependency, preserving a newer SDK already used by your project.

The core brand vectors have solid-colour API 23 fallbacks and gradient `drawable-v24` variants. Legacy launcher PNGs cover ldpi through xxxhdpi. Adaptive resources are selected from API 26; the explicit monochrome layer is selected from API 33.

## 2. Set launcher icons

Merge these attributes into your existing `<application>`:

```xml
android:icon="@mipmap/ic_cine_launcher"
android:roundIcon="@mipmap/ic_cine_launcher_round"
android:label="@string/cine_app_name"
```

See `AndroidManifest-snippet.xml` for context. It is a merge example, not a replacement for your app's manifest.

## 3. Native splash screen

Add the dependency in `build.gradle.kts.snippet`. The documented stable version checked when this pack was prepared is `androidx.core:core-splashscreen:1.2.0`.

Apply `@style/Theme.CineMusic.Starting` to your existing launcher activity. In its `onCreate`, call `installSplashScreen()` before `super.onCreate()`; `InstallSplashScreen.kt` shows the import and insertion point.

**Set `postSplashScreenTheme` to your existing app theme** in BOTH `values/cine_themes.xml` and `values-v31/cine_themes.xml`. `Theme.CineMusic` is a small framework starter theme for examples. If you use AppCompat or Material, preserve your existing compatible post-launch theme and activity base class.

The default starting theme uses the approved dark navy. To choose a light launch screen, use `@style/Theme.CineMusic.Starting.Light` instead.

The native 288 dp icon keeps the emblem inside its 192 dp visible circle. On API 31+, the wordmark is supplied in the OS branding area as a 200 × 80 dp drawable. The system controls native splash placement; it does not reproduce the centered emblem-and-wordmark composition of a full-screen image exactly.

`splash/` contains full-screen PNG/SVG compositions for design or framework workflows. `layout/cine_brand_welcome.xml` provides the centered logo-and-name layout for an in-app welcome screen. Use that layout only when your app needs such a screen; native startup does not require an additional screen or a fixed delay.

## 4. Notifications and controls

Use `@drawable/ic_cine_notification` as a notification's **small icon**. It is an un-tinted opaque white silhouette on transparent surroundings. Let Android apply its notification tint. The gradient app logo is suitable for larger artwork or a large icon.

UI controls are `@drawable/ic_cine_play`, `ic_cine_pause`, `ic_cine_next`, etc. Their default tint follows `@color/cine_on_background`; set your view/Compose tint as needed. Icon artwork is 24 dp. Supply appropriate touch-target sizing and accessible descriptions in the app.

Light/dark placeholders use the same resource names, such as `@drawable/cine_placeholder_album`, and Android selects the configured night variant automatically.

## 5. Final app checks

Build your own app after merging. Check a cold launch, a circle and squircle launcher mask, themed icons, light/dark content, and a notification. This kit was validated for resources, geometry, alpha and export dimensions; it has not been compiled or device-tested as part of your application.

## Official references checked 20 October 2026

- Adaptive icon layers, sizing and themes: https://developer.android.com/develop/ui/compose/system/icon_design_adaptive
- Native splash dimensions and layout: https://developer.android.com/develop/ui/views/launch/splash-screen
- Splash migration and installSplashScreen: https://developer.android.com/develop/ui/views/launch/splash-screen/migrate
- Stable AndroidX dependency: https://developer.android.com/jetpack/androidx/releases/core
- Play icon format: https://developer.android.com/distribute/google-play/resources/icon-design-specifications
- Feature graphic and store preview assets: https://support.google.com/googleplay/android-developer/answer/9866151
''')
    write(ROOT/'documentation/BRAND_GUIDE.md', '''# Cine music brand guide

## Identity

A bold rounded C flows into a quaver note. Cyan, blue and violet express music, energy and listening. The identity is for a music app.

## Palette

| Name | Hex | Use |
|---|---|---|
| Midnight navy | #061126 | Dark splash and brand backgrounds |
| Icon background | #071127 | Launcher icon background |
| Cyan | #00D9F2 | Primary highlight |
| Blue | #2477FF | Gradient transition |
| Violet | #8143FF | Secondary highlight |
| Magenta | #C42AF7 | Small gradient accent |
| Ivory | #F6F7FC | Light wordmarks and light surfaces |
| Ink | #101B33 | Lettering on light surfaces |

The gradient emblem uses custom intermediate stops to preserve the approved ribbon effect. Use the supplied vector instead of independently rebuilding the gradient.

## Logo selection

- `_dark` logo files have light lettering for dark backgrounds.
- `_light` logo files have dark lettering for light backgrounds.
- `_white` and `_black` files are single-colour marks for restricted colour use.
- Keep the symbol free of text inside launcher icons.
- Preserve proportions. Allow clear space of at least 15% of the symbol width around standalone logos.
- Use the simplified white notification mark at notification size. The Android monochrome icon is a transparent, single-colour layer for system tinting.

## Lettering

The wordmark is `Cine music`: a heavier Cine and a lighter music. Production lettering is outlined using DejaVu Sans Bold and DejaVu Sans ExtraLight (regular fallback when ExtraLight is unavailable). The font files are not required to display any delivered logo.

## Master files

`source_svg/cine_symbol_gradient.svg` is the standalone emblem master. Horizontal and stacked SVG logos contain editable paths, not embedded raster images. Change SVG path fills for a custom single-colour export. All included Android brand vectors use the same Bezier geometry.
''')
    write(ROOT/'source/GENERATION_PROMPTS.md', '''# Artwork provenance and prompt record

The built-in image generation tool was used for the initial approved preview and a transparent emblem reference. Production paths are a cleaned Bezier redraw, shared by the SVG, Android XML and raster exports.

## Approved preview prompt

Create a polished, spacious landscape brand preview for a music app named exactly "Cine music". A custom rounded C flows into a musical note as one bold integrated emblem. Use an electric cyan-to-violet gradient, midnight navy and soft ivory. Show a large app icon, a horizontal logo with Cine heavier and music lighter, small circular and monochrome previews, and a slim Android phone showing a centered emblem and wordmark splash. Keep the same emblem throughout. Exclude film reels, filmstrip perforations, clapperboards, cinema imagery, soundtrack references and gold/amber. Section labels: APP ICON, LOGO, SPLASH SCREEN.

## Transparent emblem reference prompt

Extract and faithfully recreate only the large cyan-blue-violet C/musical-note emblem from the approved preview. Preserve its overall silhouette and proportions: broad rounded open C curve, integrated quaver note on the right, diagonal single flag, and rounded oval note head overlapping the lower curve. Preserve the cyan-to-blue-to-violet gradient and internal overlapping ribbon detail. Center one sharp emblem on a genuinely transparent square canvas with clear margin. No tile, exterior glow, text, labels, phone or background. Preserve the approved identity.

## Rebuilding exports

Run `python3 source/build_assets.py` from the extracted pack on a system with Python 3, fonttools, Pillow, Inkscape, ImageMagick, FFmpeg and DejaVu Sans fonts. The builder regenerates vector files, PNGs, Android resources, documentation, the manifest and validation report. Font paths near the top can be changed for another system. It does not need an image-generation API or network access.
''')
    license_path=Path('/usr/share/doc/fonts-dejavu-core/copyright')
    if license_path.exists():
        shutil.copyfile(license_path, ROOT/'documentation/DejaVu_Font_Attribution.txt')

def build_manifest_and_validate():
    from PIL import Image
    failures=[]
    checks={}
    pngs=[p for p in ROOT.rglob('*.png') if '.build' not in p.parts]
    for file in pngs:
        with Image.open(file) as im:
            im.verify()
    checks['png_files_decode']=len(pngs)
    svgs=[p for p in ROOT.rglob('*.svg') if '.build' not in p.parts]
    for file in svgs:
        root=ET.parse(file).getroot()
        if any(node.tag.endswith('image') for node in root.iter()):
            failures.append(f'Embedded raster in {file.relative_to(ROOT)}')
    checks['fully_vector_svg_files']=len(svgs)
    xmls=list(RES.rglob('*.xml'))
    for file in xmls:
        ET.parse(file)
    ET.parse(ROOT/'android/AndroidManifest-snippet.xml')
    checks['android_xml_files_parse']=len(xmls)+1
    checks['ui_icons']=len(UI)
    # Resolve local resource references, excluding framework and AndroidX definitions.
    known=set()
    for file in RES.rglob('*'):
        if file.is_file():
            typ=file.parent.name.split('-')[0]
            if typ=='values' and file.suffix=='.xml':
                for node in ET.parse(file).getroot():
                    if node.get('name'):
                        known.add((node.tag,node.get('name')))
            else:
                known.add((typ,file.stem))
    for file in xmls:
        for typ,name in re.findall(r'@(drawable|mipmap|color|string|style|animator)/([A-Za-z0-9_.]+)',file.read_text()):
            if (typ,name) not in known:
                failures.append(f'Unresolved {typ}/{name} in {file.relative_to(ROOT)}')
    checks['resource_references_resolve']=True
    store=ROOT/'store/cine_music_play_store_icon_512.png'
    with Image.open(store) as im:
        checks['play_icon']={'size':list(im.size),'mode':im.mode,'bytes':store.stat().st_size}
        if im.size!=(512,512) or im.mode!='RGBA' or store.stat().st_size>1024*1024:
            failures.append('Play icon requirements')
        if im.getpixel((0,0))[3]!=255:
            failures.append('Play icon corner must be opaque and unmasked')
    feature=ROOT/'store/cine_music_feature_graphic_1024x500.png'
    with Image.open(feature) as im:
        checks['feature_graphic']={'size':list(im.size),'mode':im.mode}
        if im.size!=(1024,500) or im.mode!='RGB':
            failures.append('Feature graphic requirements')
    for density,mult in [('ldpi',.75),('mdpi',1),('hdpi',1.5),('xhdpi',2),('xxhdpi',3),('xxxhdpi',4)]:
        for name in ['ic_cine_launcher','ic_cine_launcher_round']:
            with Image.open(RES/f'mipmap-{density}/{name}.png') as im:
                if im.size!=(int(48*mult),)*2:
                    failures.append('Incorrect launcher density '+density)
        with Image.open(ROOT/f'icons/notification/{density}/ic_cine_notification.png') as im:
            if im.size!=(int(24*mult),)*2 or im.mode!='RGBA':
                failures.append('Notification size/alpha '+density)
            else:
                for r,g,b,a in im.getdata():
                    if a>0 and (r,g,b)!=(255,255,255):
                        failures.append('Notification must have white foreground '+density)
                        break
    checks['density_sets']=6
    # Read-only pixel analysis of rendered foreground verifies radial mask safety.
    with Image.open(ROOT/'icons/adaptive_png/xxxhdpi/cine_foreground.png') as im:
        alpha=im.getchannel('A')
        maxr=0
        for y in range(im.height):
            for x in range(im.width):
                if alpha.getpixel((x,y))>8:
                    maxr=max(maxr,math.hypot((x+.5)/4-54,(y+.5)/4-54))
        checks['adaptive_art_max_radius_dp']=round(maxr,3)
        if maxr>33:
            failures.append('Adaptive artwork exceeds 33 dp radial safe region')
    with Image.open(ROOT/'splash/cine_splash_icon_dark_1152.png') as im:
        alpha=im.getchannel('A')
        maxr=0
        for y in range(im.height):
            for x in range(im.width):
                if alpha.getpixel((x,y))>8:
                    maxr=max(maxr,math.hypot((x+.5)/4-144,(y+.5)/4-144))
        checks['native_splash_art_max_radius_dp']=round(maxr,3)
        if maxr>96:
            failures.append('Splash artwork exceeds 96 dp radial safe region')
    checks['native_app_build']='Not performed: this is an asset kit without a host application or Android SDK.'
    from build_animation import validate_animation
    checks['native_animated_splash']=validate_animation(sys.modules[__name__])
    checks['device_launch_test']='Not performed; integration checklist is in android/README.md.'
    report={'result':'PASS' if not failures else 'FAIL','checks':checks,'failures':failures}
    write(ROOT/'documentation/VALIDATION_REPORT.json',json.dumps(report,indent=2)+'\n')
    items=[]
    for file in sorted(ROOT.rglob('*')):
        if not file.is_file() or '.build' in file.parts or '__pycache__' in file.parts or file.name=='ASSET_MANIFEST.json':
            continue
        row={'path':str(file.relative_to(ROOT)),'bytes':file.stat().st_size,'sha256':hashlib.sha256(file.read_bytes()).hexdigest()}
        if file.suffix.lower()=='.png':
            with Image.open(file) as im:
                row.update(width=im.width,height=im.height,mode=im.mode)
        items.append(row)
    write(ROOT/'documentation/ASSET_MANIFEST.json',json.dumps({'brand':'Cine music','version':'1.0','palette':PALETTE,'files':items},indent=2)+'\n')
    print(json.dumps({'validation':report,'file_count':len(items)+1,'png_count':len(pngs),'svg_count':len(svgs)},indent=2))
    if failures:
        raise SystemExit(1)

def main():
    SVG.mkdir(parents=True,exist_ok=True)
    RES.mkdir(parents=True,exist_ok=True)
    build_sources()
    build_ui()
    build_placeholders()
    build_splash()
    build_android()
    build_store()
    build_preview()
    build_docs()
    from build_animation import build_animation, render_motion_preview
    build_animation(sys.modules[__name__])
    # Parallel local renders are independent exports from immutable vector sources.
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for _ in pool.map(render_job,RENDER_JOBS):
            pass
    render_motion_preview(sys.modules[__name__])
    build_manifest_and_validate()

if __name__=='__main__':
    main()
