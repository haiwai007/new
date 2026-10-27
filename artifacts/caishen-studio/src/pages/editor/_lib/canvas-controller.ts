import { parameterRenderDoc } from "@/lib/parameters/document";
import { ActiveSelection, Canvas, Rect, FabricImage, type FabricObject, type TPointerEventInfo, type TPointerEvent } from "fabric";
import type { Layer, TemplateDoc } from "@/types/template.ts";
import { buildBackground, buildObject, readGeometry, type ObjectMeta } from "@/lib/canvas/render.ts";
import { computeSnap, type Guide } from "./snapping.ts";

export type DrawBox = { x: number; y: number; width: number; height: number };

type Entry = { layer: Layer; obj: FabricObject; meta: ObjectMeta };

export type ControllerCallbacks = {
  onSelect: (ids: string[]) => void;
  onModify: (patches: Record<string, Partial<Layer>>) => void;
  onTextEdited: (id: string, text: string) => void;
  onDraw: (box: DrawBox) => void;
  onDrawUpdate?: (box: DrawBox|null,point?:{x:number;y:number})=>void;
  onCrop?: (id:string,focusX:number,focusY:number)=>void;
  onOverflow: (ids: string[]) => void;
  onMissing: (ids: string[]) => void;
};

/**
 * Owns the Fabric canvas. The template document is the source of truth:
 * `sync(doc)` reconciles Fabric objects to the document, and user
 * interactions are reported back as document patches via callbacks.
 */
export class CanvasController {
  readonly canvas: Canvas;
  private entries = new Map<string, Entry>();
  private metaByObj = new WeakMap<FabricObject, ObjectMeta>();
  private doc: TemplateDoc | null = null;
  private bgKey = "";
  private syncToken = 0;
  private suppressSelection = false;
  private guides: Guide[] = [];
  private drawing: { start: { x: number; y: number }; rect: Rect } | null = null;
  private drawMode = false;
  private zoom = 1;
  private parameterDrawing=false;
  private options={snap:true,ratio:null as number|null,crop:false};
  private cropping:{id:string;x:number;y:number;focusX:number;focusY:number;width:number;height:number;sign:number}|null=null;
  configure(options:Partial<{snap:boolean;ratio:number|null;crop:boolean}>){
    this.options={...this.options,...options};
    for(const entry of this.entries.values())if(entry.layer.type==="image")entry.obj.set({lockMovementX:this.options.crop,lockMovementY:this.options.crop});
  }


  constructor(el: HTMLCanvasElement, private cb: ControllerCallbacks) {
    this.canvas = new Canvas(el, {
      preserveObjectStacking: true,
      selectionColor: "rgba(200,16,46,0.08)",
      selectionBorderColor: "#c8102e",
      selectionLineWidth: 1,
      stopContextMenu: true,
      fireRightClick: false,
      targetFindTolerance: 8,
    });
    this.bindEvents();
  }

  dispose() {
    this.syncToken += 1;
    void this.canvas.dispose();
  }

  private bindEvents() {
    const c = this.canvas;
    const emitSelection = () => {
      if (this.suppressSelection) return;
      this.cb.onSelect(this.activeIds());
      const entry=this.entries.get(this.activeIds()[0]);
      c.uniformScaling=entry?.layer.type==="image"?entry.layer.lockAspect:true;
    };
    c.on("selection:created", emitSelection);
    c.on("selection:updated", emitSelection);
    c.on("selection:cleared", emitSelection);

    c.on("object:modified", () => {
      if(this.options.crop)return;
      const patches: Record<string, Partial<Layer>> = {};
      for (const obj of c.getActiveObjects()) {
        const m = this.metaByObj.get(obj);
        const entry = m ? this.entries.get(m.layerId) : undefined;
        if (!m || !entry) continue;
        patches[m.layerId] = readGeometry(obj, m, entry.layer);
      }
      this.guides = [];
      if (Object.keys(patches).length) this.cb.onModify(patches);
    });

    c.on("object:moving", (e) => {
      if (!this.doc || !this.options.snap || (e.e as MouseEvent|undefined)?.altKey || this.options.crop) {this.guides=[];return;}
      const target = e.target;
      const others = c
        .getObjects()
        .filter((o) => o.visible && !c.getActiveObjects().includes(o))
        .map((o) => o.getBoundingRect());
      const snap = computeSnap(target.getBoundingRect(), others, this.doc.canvas, 6 / this.zoom);
      if (snap.dx || snap.dy) {
        target.set({ left: target.left + snap.dx, top: target.top + snap.dy });
        target.setCoords();
      }
      this.guides = snap.guides;
    });

    c.on("mouse:up", () => {
      if (this.guides.length) {
        this.guides = [];
        c.requestRenderAll();
      }
    });

    c.on("after:render", () => this.drawGuides());

    c.on("text:editing:exited", (e) => {
      const m = this.metaByObj.get(e.target);
      if (!m) return;
      const entry = this.entries.get(m.layerId);
      const text = e.target.text ?? "";
      if (entry && entry.layer.type === "text" && entry.layer.text !== text) {
        this.cb.onTextEdited(m.layerId, text);
      }
    });

    c.on("mouse:down", (e) => {
      if(this.options.crop&&!this.drawMode){
        const id=this.activeIds()[0],entry=this.entries.get(id);
        if(entry?.layer.type==="image"){
          const p=c.getScenePoint(e.e),l=entry.layer;
          const image=entry.obj instanceof FabricImage?entry.obj:null,natural=image?.getOriginalSize();
          const contain=l.fit==="contain",width=contain?l.width-entry.obj.getScaledWidth():(natural?.width??l.width)*(image?.scaleX??1)-l.width,height=contain?l.height-entry.obj.getScaledHeight():(natural?.height??l.height)*(image?.scaleY??1)-l.height;
          this.cropping={id,x:p.x,y:p.y,focusX:l.focusX,focusY:l.focusY,width:Math.max(1,width),height:Math.max(1,height),sign:contain?1:-1};
          entry.obj.set({lockMovementX:true,lockMovementY:true});return;
        }
      }
      this.onDrawStart(e);
    });
    c.on("mouse:move", (e) => {
      if(this.cropping){const p=c.getScenePoint(e.e),s=this.cropping;this.cb.onCrop?.(s.id,Math.max(0,Math.min(1,s.focusX+s.sign*(p.x-s.x)/s.width)),Math.max(0,Math.min(1,s.focusY+s.sign*(p.y-s.y)/s.height)));return;}
      this.onDrawMove(e);
    });
    c.on("mouse:up", () => {this.cropping=null;this.onDrawEnd();});
  }

  private drawGuides() {
    if (!this.guides.length || !this.doc) return;
    const ctx = this.canvas.getContext();
    const vpt = this.canvas.viewportTransform;
    ctx.save();
    ctx.setTransform(vpt[0], vpt[1], vpt[2], vpt[3], vpt[4], vpt[5]);
    ctx.strokeStyle = "#e0218a";
    ctx.lineWidth = 1 / this.zoom;
    ctx.setLineDash([4 / this.zoom, 3 / this.zoom]);
    for (const g of this.guides) {
      ctx.beginPath();
      if (g.axis === "x") {
        ctx.moveTo(g.pos, 0);
        ctx.lineTo(g.pos, this.doc.canvas.height);
      } else {
        ctx.moveTo(0, g.pos);
        ctx.lineTo(this.doc.canvas.width, g.pos);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // ----- drawing a box (frame / mask / text area) -----

  setDrawMode(on: boolean, parameterDrawing=false) {
    this.parameterDrawing=parameterDrawing;
    this.cb.onDrawUpdate?.(null);
    // Cancelling or switching tools must not leave a preview rectangle behind.
    if (this.drawing) {this.canvas.remove(this.drawing.rect); this.drawing = null;}
    this.drawMode = on;
    this.canvas.selection = !on;
    this.canvas.skipTargetFind = on;
    this.canvas.defaultCursor = on ? "crosshair" : "default";
    if (on) {
      this.suppressSelection = true;
      this.canvas.discardActiveObject();
      this.suppressSelection = false;
      this.cb.onSelect([]);
    }
    this.canvas.requestRenderAll();
  }

  private onDrawStart(e: TPointerEventInfo<TPointerEvent>) {
    if (!this.drawMode) return;
    const p = this.canvas.getScenePoint(e.e);
    p.x=Math.max(0,Math.min(this.doc?.canvas.width??p.x,p.x));p.y=Math.max(0,Math.min(this.doc?.canvas.height??p.y,p.y));
    const rect = new Rect({
      left: p.x,
      top: p.y,
      width: 1,
      height: 1,
      originX: "left",
      originY: "top",
      fill: "transparent",
      stroke: "#c8102e",
      strokeWidth: 2 / this.zoom,
      strokeDashArray: [8 / this.zoom, 6 / this.zoom],
      selectable: false,
      evented: false,
      excludeFromExport: true,
    });
    this.canvas.add(rect);
    this.drawing = { start: { x: p.x, y: p.y }, rect };
  }

  private onDrawMove(e: TPointerEventInfo<TPointerEvent>) {
    if(!this.drawing||!this.doc)return;
    const p=this.canvas.getScenePoint(e.e),{start,rect}=this.drawing;
    p.x=Math.max(0,Math.min(this.doc.canvas.width,p.x));p.y=Math.max(0,Math.min(this.doc.canvas.height,p.y));
    if(this.options.snap&&!(e.e as MouseEvent).altKey){
      const others=this.doc.layers.filter(l=>l.visible).map(l=>({left:l.x,top:l.y,width:l.width,height:l.height}));
      const snap=computeSnap({left:p.x,top:p.y,width:0,height:0},others,this.doc.canvas,6/this.zoom);
      p.x+=snap.dx;p.y+=snap.dy;this.guides=snap.guides;
    }
    let width=Math.abs(p.x-start.x),height=Math.abs(p.y-start.y);
    if(this.options.ratio){
      if(width/Math.max(.001,height)>this.options.ratio)height=width/this.options.ratio;else width=height*this.options.ratio;
      const scale=Math.min(1,(p.x>=start.x?this.doc.canvas.width-start.x:start.x)/Math.max(1,width),(p.y>=start.y?this.doc.canvas.height-start.y:start.y)/Math.max(1,height));
      width*=scale;height*=scale;
    }
    const box={x:p.x<start.x?start.x-width:start.x,y:p.y<start.y?start.y-height:start.y,width,height};
    rect.set({left:box.x,top:box.y,width,height});
    this.cb.onDrawUpdate?.(box,p);
    this.canvas.requestRenderAll();
  }

  private onDrawEnd() {
    if (!this.drawing || !this.doc) return;
    const { rect, start } = this.drawing;
    this.drawing = null;
    this.canvas.remove(rect);
    const W = this.doc.canvas.width;
    const H = this.doc.canvas.height;
    let box: DrawBox = { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
    this.cb.onDrawUpdate?.(null);
    this.guides=[];
    // Keep tiny parameter selections editable instead of discarding them.
    if(this.parameterDrawing&&(box.width<4||box.height<4)){
      box={...box,width:Math.max(24/this.zoom,box.width),height:Math.max(20/this.zoom,box.height)};
      if(this.options.ratio)box.height=box.width/this.options.ratio;
    }
    else if (box.width < 8 || box.height < 8) {
      const w = W * 0.4;
      const h = H * 0.12;
      box = { x: start.x - w / 2, y: start.y - h / 2, width: w, height: h };
    }
    if(this.parameterDrawing)box={...box,width:Math.min(W,box.width),height:Math.min(H,box.height),x:Math.max(0,Math.min(box.x,W-Math.min(W,box.width))),y:Math.max(0,Math.min(box.y,H-Math.min(H,box.height)))};
    const x = Math.max(0, box.x);
    const y = Math.max(0, box.y);
    box = {
      x,
      y,
      width: Math.min(W - x, box.width - (x - box.x)),
      height: Math.min(H - y, box.height - (y - box.y)),
    };
    if (box.width >= 2 && box.height >= 2) this.cb.onDraw(box);
  }

  // ----- zoom -----

  setViewport(doc: TemplateDoc, zoom: number) {
    this.zoom = zoom;
    this.canvas.setDimensions({
      width: Math.round(doc.canvas.width * zoom),
      height: Math.round(doc.canvas.height * zoom),
    });
    this.canvas.setZoom(zoom);
    this.canvas.requestRenderAll();
  }

  // ----- selection -----

  private activeIds(): string[] {
    return this.canvas
      .getActiveObjects()
      .map((o) => this.metaByObj.get(o)?.layerId)
      .filter((x): x is string => Boolean(x));
  }

  applySelection(ids: string[]) {
    const cur = this.activeIds();
    if (cur.length === ids.length && cur.every((id) => ids.includes(id))) return;
    this.suppressSelection = true;
    this.canvas.discardActiveObject();
    const objs = ids
      .map((id) => this.entries.get(id))
      .filter((e): e is Entry => Boolean(e) && e!.obj.selectable && e!.obj.visible)
      .map((e) => e.obj);
    if (objs.length === 1) this.canvas.setActiveObject(objs[0]);
    else if (objs.length > 1) this.canvas.setActiveObject(new ActiveSelection(objs, { canvas: this.canvas }));
    this.suppressSelection = false;
    this.canvas.requestRenderAll();
  }

  /** Start inline editing of a text layer (used right after creating one). */
  editText(id: string) {
    const e = this.entries.get(id);
    if (!e || e.layer.type !== "text") return;
    const tb = e.obj as FabricObject & { enterEditing?: () => void; selectAll?: () => void };
    this.canvas.setActiveObject(e.obj);
    tb.enterEditing?.();
    tb.selectAll?.();
    this.canvas.requestRenderAll();
  }

  // ----- reconcile -----

  async sync(doc: TemplateDoc, selectedIds: string[]) {
    const token = ++this.syncToken;
    doc = parameterRenderDoc(doc, true);
    this.doc = doc;
    const c = this.canvas;

    const bgKey = JSON.stringify([doc.canvas.backgroundImage, doc.canvas.width, doc.canvas.height]);
    const bgPromise = bgKey !== this.bgKey ? buildBackground(doc) : null;

    const results = await Promise.all(
      doc.layers.map(async (layer): Promise<Entry> => {
        const existing = this.entries.get(layer.id);
        if (existing && existing.layer === layer) return existing;
        const built = await buildObject(layer, true);
        return { layer, obj: built.obj, meta: built.meta };
      }),
    );
    const bg = bgPromise ? await bgPromise : undefined;
    if (token !== this.syncToken) return;

    c.backgroundColor = doc.canvas.backgroundColor;
    if (bg !== undefined) {
      c.backgroundImage = bg ?? undefined;
      this.bgKey = bgKey;
    }

    const nextIds = new Set(results.map((r) => r.layer.id));
    const changed = new Set<FabricObject>();
    for (const [id, e] of this.entries) {
      if (!nextIds.has(id)) changed.add(e.obj);
    }
    for (const r of results) {
      const old = this.entries.get(r.layer.id);
      if (old && old.obj !== r.obj) changed.add(old.obj);
    }

    // Objects inside an active selection have group-relative coordinates,
    // so release the selection before swapping any of them.
    const active = c.getActiveObjects();
    const editing = active.some((o) => (o as FabricObject & { isEditing?: boolean }).isEditing);
    if (active.some((o) => changed.has(o)) && !editing) {
      this.suppressSelection = true;
      c.discardActiveObject();
      this.suppressSelection = false;
    }

    for (const [id, e] of this.entries) {
      if (!nextIds.has(id)) c.remove(e.obj);
    }
    const nextEntries = new Map<string, Entry>();
    for (const r of results) {
      const old = this.entries.get(r.layer.id);
      if (old && old.obj !== r.obj) {
        const idx = c.getObjects().indexOf(old.obj);
        c.remove(old.obj);
        c.insertAt(Math.max(0, idx), r.obj);
      } else if (!old) {
        c.add(r.obj);
      }
      if(r.layer.type==="image"&&this.options.crop)r.obj.set({lockMovementX:true,lockMovementY:true});
      this.metaByObj.set(r.obj, r.meta);
      nextEntries.set(r.layer.id, r);
    }
    this.entries = nextEntries;
    results.forEach((r, i) => {
      if (c.getObjects()[i] !== r.obj) c.moveObjectTo(r.obj, i);
    });

    this.cb.onOverflow(results.filter((r) => r.meta.overflow).map((r) => r.layer.id));
    this.cb.onMissing(results.filter((r) => r.meta.missing && !(r.layer.type === "image" && !r.layer.src && r.layer.opacity===0)).map((r) => r.layer.id));
    if (!editing) this.applySelection(selectedIds);
    c.requestRenderAll();
  }
}
