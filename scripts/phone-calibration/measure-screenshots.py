"""Measure native reference pixels, without resampling or publishing source images.
Usage: python3 scripts/phone-calibration/measure-screenshots.py CONFIG.json OUTPUT.json
Optional offline tooling dependency: Pillow. Full screenshots stay in the local research cache.
"""
import sys, json, hashlib
from PIL import Image

rows=json.load(open(sys.argv[1],encoding="utf-8"))
output=[]
for row in rows:
    data=open(row["file"],"rb").read()
    image=Image.open(row["file"]).convert("RGB")
    if image.size != (row["width"],row["height"]): raise ValueError("Native dimensions do not match: "+row["id"])
    width,height=image.size
    clock=[];system=[]
    for y in range(row["stripHeight"]):
        for x in range(width):
            pixel=image.getpixel((x,y))
            neutral=max(pixel)-min(pixel)<45
            glyph=(min(pixel)>180 and neutral) if row["light"] else (max(pixel)<170 and neutral)
            if glyph and x<int(width*row["clockFraction"]):clock.append((x,y))
            foreground=(max(pixel)>40) if row.get("systemAllColours") else glyph
            if foreground and x>int(width*.7):system.append((x,y))
    def box(points):
        if not points:raise ValueError("No measurable foreground: "+row["id"])
        return {"left":min(x for x,y in points),"top":min(y for x,y in points),"right":max(x for x,y in points)+1,"bottom":max(y for x,y in points)+1}
    item={k:v for k,v in row.items() if k!="file"}
    item.update({"sha256":hashlib.sha256(data).hexdigest(),"clockBox":box(clock),"systemBox":box(system),"method":"native RGB threshold in explicit ROIs; no image resizing; partial geometry evidence only"})
    output.append(item)
with open(sys.argv[2],"w",encoding="utf-8") as file:json.dump(output,file,ensure_ascii=False,indent=2);file.write("\n")
