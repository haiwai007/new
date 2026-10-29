"""Build portable numeric SVG outlines from pinned, licensed font files. Requires fontTools."""
from pathlib import Path
import json,hashlib,sys
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools import subset
root=Path(sys.argv[1] if len(sys.argv)>1 else '/tmp')
sources=json.loads(Path('docs/phone-calibration/font-sources.json').read_text())['rows']
for source in sources:
 for field,checksum in [('file','sha256'),('licenseFile','licenseSha256')]:
  if hashlib.sha256((root/source[field]).read_bytes()).hexdigest()!=source[checksum]:raise ValueError('Changed font or licence: '+source[field])
chars='0123456789%: AMP\u00a0';out={}
for name,file,axes in [('google-sans-17-500','GoogleSans.ttf',dict(GRAD=0,opsz=17,wght=500)),('google-sans-18-500','GoogleSans.ttf',dict(GRAD=0,opsz=18,wght=500)),('roboto-400','aosp14-Roboto-Regular.ttf',dict(wght=400,wdth=100,ital=0))]:
 font=TTFont(root/file);sub=subset.Subsetter();sub.populate(text=chars);sub.subset(font);font=instantiateVariableFont(font,axes,inplace=True);gs=font.getGlyphSet();cm=font.getBestCmap();glyphs={}
 for ch in chars:
  glyph=cm[ord(ch)];pen=SVGPathPen(gs,ntos=lambda n:format(n,'.4f').rstrip('0').rstrip('.') if n else '0');gs[glyph].draw(pen);glyphs[ch]=dict(d=pen.getCommands(),advance=font['hmtx'][glyph][0])
 out[name]=dict(units=font['head'].unitsPerEm,glyphs=glyphs)
header='// Generated licensed numeric contours. Google Sans: Copyright 2025 The Google Sans Project Authors, OFL-1.1.\n// Roboto: Copyright 2011 Google Inc., Apache-2.0. See public/attributions and docs/phone-calibration/font-sources.json.\n'
Path('artifacts/caishen-studio/src/lib/phone/numeric-font-data.ts').write_text(header+'export const NUMERIC_FONT_DATA = '+json.dumps(out,ensure_ascii=True,separators=(',',':'))+' as const;\n')
print(json.dumps(dict(fonts=list(out),glyphsPerFont=len(out[next(iter(out))]['glyphs']))))
