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
    if row.get("sha256") and hashlib.sha256(data).hexdigest()!=row["sha256"]:raise ValueError("Source hash changed; review before measuring: "+row["id"])
    image=Image.open(row["file"]).convert("RGB")
    if image.size != (row["width"],row["height"]): raise ValueError("Native dimensions do not match: "+row["id"])
    width,height=image.size
    clock=[];system=[]
    clock_rect=row.get("clockRect",[0,0,int(width*row["clockFraction"]),row.get("clockYLimit",row["stripHeight"])])
    for y in range(row["stripHeight"]):
        for x in range(width):
            pixel=image.getpixel((x,y))
            neutral=max(pixel)-min(pixel)<45
            glyph=(min(pixel)>row.get("whiteThreshold",180) and neutral) if row["light"] else (max(pixel)<170 and neutral)
            if glyph and clock_rect[0] <= x < clock_rect[0]+clock_rect[2] and clock_rect[1] <= y < clock_rect[1]+clock_rect[3]:clock.append((x,y))
            foreground=(max(pixel)>40) if row.get("systemAllColours") else glyph
            if foreground and x>int(width*.7):system.append((x,y))
    def remove_specks(points):
        minimum=row.get("minComponentArea",0)
        if not minimum:return points
        remaining=set(points);kept=[]
        while remaining:
            seed=remaining.pop();component=[seed];stack=[seed]
            while stack:
                x,y=stack.pop()
                for neighbor in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
                    if neighbor in remaining:remaining.remove(neighbor);component.append(neighbor);stack.append(neighbor)
            if len(component)>=minimum:kept.extend(component)
        return kept
    clock=remove_specks(clock);system=remove_specks(system)
    def box(points):
        if not points:raise ValueError("No measurable foreground: "+row["id"])
        return {"left":min(x for x,y in points),"top":min(y for x,y in points),"right":max(x for x,y in points)+1,"bottom":max(y for x,y in points)+1}
    clock_box=box(clock)
    if "clockRect" in row and (clock_box["left"] <= clock_rect[0] or clock_box["top"] <= clock_rect[1] or clock_box["right"] >= clock_rect[0]+clock_rect[2] or clock_box["bottom"] >= clock_rect[1]+clock_rect[3]):raise ValueError("Clock touches ROI border; review the selection: "+row["id"])
    item={k:v for k,v in row.items() if k!="file"}
    item.update({"sha256":hashlib.sha256(data).hexdigest(),"clockBox":box(clock),"systemBox":box(system),"method":"native RGB threshold in explicit ROIs; no image resizing; partial geometry evidence only"})
    output.append(item)
with open(sys.argv[2],"w",encoding="utf-8") as file:json.dump(output,file,ensure_ascii=False,indent=2);file.write("\n")
