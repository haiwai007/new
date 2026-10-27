import ParameterRegionToolbar from "./parameter-region-toolbar";
import {parameterPreviewDoc,parameterLayerIds} from "@/lib/parameters/document";
import { useEffect, useRef, useState, useMemo } from "react";
import { AlertTriangle, ImageOff } from "lucide-react";
import { useEditor } from "@/stores/editor.ts";
import { updateLayer, updateLayers } from "@/lib/template/doc-ops.ts";
import { CanvasController } from "../_lib/canvas-controller.ts";
import { handleDrawnBox } from "../_lib/actions.ts";

export type StageApi = { fit: () => void };

export default function CanvasStage({
  onReady,
}: {
  onReady: (api: StageApi) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctrlRef = useRef<CanvasController | null>(null);
  const doc = useEditor((s) => s.doc);
  const selectedIds = useEditor((s) => s.selectedIds);
  const zoom = useEditor((s) => s.zoom);
  const tool = useEditor((s) => s.tool);
  const locating = useEditor((s) => s.leftPanel === "status-location");
  const previewValues=useEditor(s=>s.previewValues),previewPatches=useEditor(s=>s.previewPatches);
  const isTemplate=useEditor(s=>s.isTemplate),parameterBox=useEditor(s=>s.parameterBox);
  const snapEnabled=useEditor(s=>s.snapEnabled),drawRatio=useEditor(s=>s.drawRatio),cropMode=useEditor(s=>s.cropMode),magnifierEnabled=useEditor(s=>s.magnifierEnabled);
  const viewDoc=useMemo(()=>doc?parameterPreviewDoc(doc,previewValues,previewPatches):null,[doc,previewValues,previewPatches]);
  const [drawState,setDrawState]=useState<{box:{x:number;y:number;width:number;height:number};point?:{x:number;y:number}}|null>(null);
  const magnifierRef=useRef<HTMLCanvasElement>(null);
  const focusId=useRef<string|null>(null);

  const [overflow, setOverflow] = useState<string[]>([]);
  const [missing, setMissing] = useState<string[]>([]);

  // Create the Fabric canvas once.
  useEffect(() => {
    if (!canvasRef.current) return;
    const ctrl = new CanvasController(canvasRef.current, {
      onSelect: (ids) => {
        const state=useEditor.getState();state.select(ids);
        const p=state.doc?.parameters.find(p=>parameterLayerIds(p).some(id=>ids.includes(id)));
        if(p&&state.isTemplate){state.setActiveParam(p.id);state.setRightTab("props");}
      },
      onModify: (patches) => {
        const { doc: d, commit } = useEditor.getState();
        if (d) commit(updateLayers(d, patches));
      },
      onTextEdited: (id, text) => {
        const { doc: d, commit } = useEditor.getState();
        if (d) commit(updateLayer(d, id, { text }));
      },
      onDraw: (box) => {
        const textId = handleDrawnBox(box);
        if (textId) setTimeout(() => ctrlRef.current?.editText(textId), 120);
      },
      onDrawUpdate:(box,point)=>setDrawState(box?{box,point}:null),
      onCrop:(id,focusX,focusY)=>{
        const state=useEditor.getState(),p=state.doc?.parameters.find(p=>parameterLayerIds(p).includes(id));
        const patch={focusX,focusY,autoFocus:false};
        if(state.isTemplate&&p&&Object.prototype.hasOwnProperty.call(state.previewValues,p.id))state.setPreviewPatch(id,patch);
        else if(state.doc)state.commit(updateLayer(state.doc,id,patch),{coalesceKey:`crop:${id}`});
      },
      onOverflow: setOverflow,
      onMissing: setMissing,
    });
    ctrlRef.current = ctrl;
    return () => {
      ctrl.dispose();
      ctrlRef.current = null;
    };
  }, []);

  // Fit-to-screen helper exposed to the toolbar.
  useEffect(() => {
    const fit = () => {
      const el = wrapRef.current;
      const d = useEditor.getState().doc;
      if (!el || !d) return;
      const pad = 48;
      const z = Math.min(
        (el.clientWidth - pad) / d.canvas.width,
        (el.clientHeight - pad) / d.canvas.height,
      );
      useEditor.getState().setZoom(Math.max(0.05, Math.min(2, z)));
    };
    onReady({ fit });
    fit();
    // Only on mount: later fits are user-triggered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.templateId]);

  useEffect(() => {
    if (ctrlRef.current && doc) ctrlRef.current.setViewport(doc, zoom);
  }, [doc?.canvas.width, doc?.canvas.height, zoom, doc]);

  useEffect(() => {
    if (ctrlRef.current && viewDoc)
      void ctrlRef.current.sync(viewDoc, useEditor.getState().selectedIds);
  }, [viewDoc]);

  useEffect(() => {
    ctrlRef.current?.applySelection(selectedIds);
  }, [selectedIds]);

  useEffect(() => {
    ctrlRef.current?.setDrawMode(tool !== "select", tool === "draw-parameter");
  }, [tool]);

  useEffect(()=>{ctrlRef.current?.configure({snap:snapEnabled,ratio:drawRatio,crop:cropMode});},[snapEnabled,drawRatio,cropMode]);
  useEffect(()=>{
    const onFocus=(event:Event)=>{
      const detail=(event as CustomEvent<{id:string;zoom?:boolean}>).detail;
      const state=useEditor.getState(),layer=state.doc?.layers.find(l=>l.id===detail.id);
      if(!layer)return;focusId.current=layer.id;
      if(detail.zoom)state.setZoom(Math.min(2.5,Math.max(.1,320/Math.max(1,layer.width),160/Math.max(1,layer.height))));
      requestAnimationFrame(()=>scrollFocus());
    };
    const scrollFocus=()=>{
      const wrap=wrapRef.current,state=useEditor.getState(),layer=state.doc?.layers.find(l=>l.id===focusId.current);
      if(!wrap||!layer)return;
      const canvas=canvasRef.current?.getBoundingClientRect(),container=wrap.getBoundingClientRect();
      if(canvas)wrap.scrollTo({left:wrap.scrollLeft+canvas.left-container.left+(layer.x+layer.width/2)*state.zoom-wrap.clientWidth/2,top:wrap.scrollTop+canvas.top-container.top+(layer.y+layer.height/2)*state.zoom-wrap.clientHeight/2,behavior:"smooth"});
    };
    window.addEventListener("haishen:focus-layer",onFocus);return()=>window.removeEventListener("haishen:focus-layer",onFocus);
  },[]);
  useEffect(()=>{
    if(!drawState||!magnifierEnabled||!magnifierRef.current||!ctrlRef.current)return;
    const canvas=magnifierRef.current,source=ctrlRef.current.canvas.getElement(),p=drawState.point??drawState.box;
    const scale=source.width/(useEditor.getState().doc?.canvas.width??source.width);
    const size=Math.min(64,source.width,source.height),x=Math.max(0,Math.min(source.width-size,p.x*scale-size/2)),y=Math.max(0,Math.min(source.height-size,p.y*scale-size/2));
    const ctx=canvas.getContext("2d");if(!ctx)return;ctx.clearRect(0,0,128,128);ctx.drawImage(source,x,y,size,size,0,0,128,128);
    ctx.strokeStyle="#c8102e";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(64,0);ctx.lineTo(64,128);ctx.moveTo(0,64);ctx.lineTo(128,64);ctx.stroke();
  },[drawState,magnifierEnabled]);
  useEffect(()=>{
    const wrap=wrapRef.current;if(!wrap)return;
    let space=false,drag:{x:number;y:number;left:number;top:number}|null=null;
    let pinch:{distance:number;zoom:number;left:number;top:number;cx:number;cy:number}|null=null;
    const key=(e:KeyboardEvent)=>{if((e.target as HTMLElement)?.closest("input,textarea,select,button,[contenteditable=true]"))return;if(e.code==="Space"){space=e.type==="keydown";e.preventDefault();}};
    const down=(e:PointerEvent)=>{if(!space&&e.button!==1)return;drag={x:e.clientX,y:e.clientY,left:wrap.scrollLeft,top:wrap.scrollTop};wrap.setPointerCapture(e.pointerId);e.preventDefault();e.stopPropagation();};
    const move=(e:PointerEvent)=>{if(!drag)return;wrap.scrollLeft=drag.left-(e.clientX-drag.x);wrap.scrollTop=drag.top-(e.clientY-drag.y);e.preventDefault();e.stopPropagation();};
    const up=()=>{drag=null;};
    const start=(e:TouchEvent)=>{if(e.touches.length!==2)return;e.stopPropagation();e.preventDefault();const[a,b]=[e.touches[0],e.touches[1]],r=wrap.getBoundingClientRect();pinch={distance:Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY),zoom:useEditor.getState().zoom,left:wrap.scrollLeft,top:wrap.scrollTop,cx:(a.clientX+b.clientX)/2-r.left,cy:(a.clientY+b.clientY)/2-r.top};ctrlRef.current?.setDrawMode(useEditor.getState().tool!=="select",useEditor.getState().tool==="draw-parameter");};
    const touchmove=(e:TouchEvent)=>{if(!pinch||e.touches.length!==2)return;e.stopPropagation();e.preventDefault();const[a,b]=[e.touches[0],e.touches[1]],r=wrap.getBoundingClientRect();const ratio=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY)/Math.max(1,pinch.distance),zoom=Math.max(.05,Math.min(4,pinch.zoom*ratio)),factor=zoom/pinch.zoom,cx=(a.clientX+b.clientX)/2-r.left,cy=(a.clientY+b.clientY)/2-r.top;useEditor.getState().setZoom(zoom);const p=pinch;requestAnimationFrame(()=>{wrap.scrollLeft=(p.left+p.cx)*factor-cx;wrap.scrollTop=(p.top+p.cy)*factor-cy;});};
    const touchend=(e:TouchEvent)=>{if(pinch){e.stopPropagation();if(e.touches.length===0)pinch=null;}};
    window.addEventListener("keydown",key);window.addEventListener("keyup",key);
    wrap.addEventListener("pointerdown",down,true);wrap.addEventListener("pointermove",move,true);wrap.addEventListener("pointerup",up,true);wrap.addEventListener("pointercancel",up,true);
    wrap.addEventListener("touchstart",start,{capture:true,passive:false});wrap.addEventListener("touchmove",touchmove,{capture:true,passive:false});wrap.addEventListener("touchend",touchend,true);
    return()=>{window.removeEventListener("keydown",key);window.removeEventListener("keyup",key);wrap.removeEventListener("pointerdown",down,true);wrap.removeEventListener("pointermove",move,true);wrap.removeEventListener("pointerup",up,true);wrap.removeEventListener("pointercancel",up,true);wrap.removeEventListener("touchstart",start,true);wrap.removeEventListener("touchmove",touchmove,true);wrap.removeEventListener("touchend",touchend,true);};
  },[]);

  // Ctrl + wheel zoom.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const { zoom: z, setZoom } = useEditor.getState();
      setZoom(z * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const names = (ids: string[]) =>
    ids
      .map((id) => doc?.layers.find((l) => l.id === id)?.name)
      .filter(Boolean)
      .join("、");

  const toolHint: Record<string, string> = {
    "draw-parameter":"拖拽框选参数区域；松手后选择订单号、头像或 Logo。空格拖动画布，双指缩放。",
    "draw-text": "在画布上拖拽框出文字区域",
    "draw-image": "在画布上拖拽框出图片区域",
    "draw-mask": "拖拽框出需要遮盖的原图文字",
    "draw-rect": "拖拽绘制矩形",
    "draw-ocr": "拖拽框出要识别的文字区域",
  };

  const selectedParameter=doc?.parameters.find(p=>parameterLayerIds(p).some(id=>selectedIds.includes(id)));
  const selectedLayer=doc?.layers.find(l=>l.id===selectedIds[0]);
  const overlap=selectedLayer?doc?.layers.filter(l=>l.visible&&doc.parameters.some(p=>parameterLayerIds(p).includes(l.id))&&l.x<selectedLayer.x+selectedLayer.width&&l.x+l.width>selectedLayer.x&&l.y<selectedLayer.y+selectedLayer.height&&l.y+l.height>selectedLayer.y)??[]:[];
  const viewport=wrapRef.current?.getBoundingClientRect(),imageRect=canvasRef.current?.getBoundingClientRect();
  const toolbarWidth=Math.min(320,Math.max(160,(viewport?.width??352)-16));
  const toolbarStyle=parameterBox&&viewport&&imageRect?{left:Math.max(viewport.left+8,Math.min(imageRect.left+parameterBox.x*zoom,viewport.right-toolbarWidth-8)),top:Math.max(viewport.top+8,Math.min(imageRect.top+(parameterBox.y+parameterBox.height)*zoom+8,viewport.bottom-172)),width:toolbarWidth}:undefined;
  return (
    <div
      ref={wrapRef}
      className="relative flex-1 overflow-auto bg-[radial-gradient(circle,oklch(0.5_0_0/0.14)_1px,transparent_1px)] [background-size:18px_18px]"
      onMouseDown={(e) => {
        if (e.target === wrapRef.current) useEditor.getState().select([]);
      }}
    >
      <div
        className="flex min-h-full min-w-full items-center justify-center p-6"
        style={{
          width: "max-content",
          height: "max-content",
          minWidth: "100%",
          minHeight: "100%",
        }}
      >
        <div
          className="relative shadow-[0_10px_40px_-10px_rgba(0,0,0,0.35)] [&_.canvas-container]:touch-none"
          style={{
            backgroundImage:
              "repeating-conic-gradient(#e6e6e6 0 25%, #fff 0 50%)",
            backgroundSize: "16px 16px",
          }}
        >
          <canvas ref={canvasRef} />
          {parameterBox&&doc&&<>
            <svg className="pointer-events-none absolute inset-0" width={doc.canvas.width*zoom} height={doc.canvas.height*zoom} viewBox={`0 0 ${doc.canvas.width} ${doc.canvas.height}`} aria-label="新参数框选区域"><rect x={parameterBox.x} y={parameterBox.y} width={parameterBox.width} height={parameterBox.height} fill="none" stroke="#c8102e" strokeWidth={2/zoom}/></svg>
            <div className="fixed z-20 max-w-full" style={toolbarStyle}><ParameterRegionToolbar/></div>
          </>}

          {locating &&
            doc?.statusLocation &&
            doc.statusLocation.state !== "skipped" && (
              <svg
                className="pointer-events-none absolute inset-0"
                width={doc.canvas.width * zoom}
                height={doc.canvas.height * zoom}
                viewBox={`0 0 ${doc.canvas.width} ${doc.canvas.height}`}
                aria-label="状态栏候选框"
              >
                {[
                  doc.statusLocation.bounds,
                  doc.statusLocation.time,
                  doc.statusLocation.apps,
                  doc.statusLocation.system,
                  ...doc.statusLocation.protected,
                ].map(
                  (r, i) =>
                    r && (
                      <rect
                        key={i}
                        x={r.x * doc.canvas.width}
                        y={
                          r.y *
                            (doc.canvas.height -
                              (doc.phone?.addedHeight ?? 0)) +
                          (doc.phone?.addedHeight ?? 0)
                        }
                        width={r.width * doc.canvas.width}
                        height={
                          r.height *
                          (doc.canvas.height - (doc.phone?.addedHeight ?? 0))
                        }
                        fill="none"
                        stroke={
                          i === 0 ? "#ef4444" : i >= 4 ? "#d97706" : "#2563eb"
                        }
                        strokeWidth={1.5}
                        vectorEffect="non-scaling-stroke"
                        strokeDasharray={i === 0 ? "5 3" : undefined}
                      />
                    ),
                )}
              </svg>
            )}
        </div>
      </div>
      {drawState&&<div className="pointer-events-none sticky bottom-3 left-3 z-20 flex w-max items-end gap-2 rounded bg-background/95 p-2 text-xs shadow" data-testid="draw-dimensions"><span>{Math.round(drawState.box.width)} × {Math.round(drawState.box.height)} px</span>{magnifierEnabled&&<canvas ref={magnifierRef} width={128} height={128} className="size-32 rounded border" aria-label="框选局部放大镜"/>}</div>}
      {isTemplate&&selectedParameter&&selectedLayer&&!parameterBox&&tool==="select"&&<div className="sticky bottom-3 left-3 z-10 flex w-fit max-w-full flex-wrap gap-1 rounded border bg-background/95 p-1 shadow" aria-label="选中参数快捷操作">
        <button className="min-h-8 rounded px-2 text-xs hover:bg-muted" onClick={()=>{useEditor.getState().setRedrawLayer(selectedLayer.id);useEditor.getState().setTool("draw-parameter");}}>重画选中区域</button>
        {overlap.length>1&&<button className="min-h-8 rounded px-2 text-xs hover:bg-muted" onClick={()=>{const index=overlap.findIndex(l=>l.id===selectedLayer.id);const next=overlap[(index+1)%overlap.length];useEditor.getState().select([next.id]);}}>切换重叠区域</button>}
        <button className="min-h-8 rounded px-2 text-xs hover:bg-muted" onClick={()=>window.dispatchEvent(new CustomEvent("haishen:focus-layer",{detail:{id:selectedLayer.id,zoom:true}}))}>放大微调</button>
      </div>}
      {cropMode&&<div className="sticky bottom-3 left-3 z-20 w-fit rounded border bg-background p-2 text-xs">画布裁剪中：拖动选中的图片调整焦点。<button className="ml-2 underline" onClick={()=>{useEditor.getState().setDrawOptions({cropMode:false});window.dispatchEvent(new CustomEvent("haishen:parameter-settings"));}}>完成裁剪</button></div>}
      {tool !== "select" && (
        <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-foreground px-4 py-1.5 text-xs text-background shadow">
          {toolHint[tool]} · 按 Esc 取消
        </div>
      )}
      {(overflow.length > 0 || missing.length > 0) && (
        <div className="absolute bottom-3 left-3 flex max-w-md flex-col gap-1">
          {overflow.length > 0 && (
            <p className="flex items-center gap-1.5 rounded-md bg-amber-100 px-2.5 py-1 text-xs text-amber-900 shadow dark:bg-amber-900/70 dark:text-amber-100">
              <AlertTriangle className="size-3.5 shrink-0" /> 文字超出文本框：
              {names(overflow)}
            </p>
          )}
          {missing.length > 0 && (
            <p className="flex items-center gap-1.5 rounded-md bg-red-100 px-2.5 py-1 text-xs text-red-900 shadow dark:bg-red-900/70 dark:text-red-100">
              <ImageOff className="size-3.5 shrink-0" /> 图片加载失败：
              {names(missing)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
