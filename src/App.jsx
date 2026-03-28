import { useState, useRef, useEffect, useCallback } from "react";

const W = 1280, H = 480;

// ── utils ──────────────────────────────────────────────────────────────────────
function fileToDataUrl(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = e => res(e.target.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}
function loadImg(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}
function divX(baseX, deg) {
  const oh = Math.tan((deg * Math.PI) / 180) * H;
  return { top: baseX - oh / 2, bot: baseX + oh / 2 };
}
function paintSlot(ctx, img, cx, slotW, ohMax, align, zoom, pan) {
  const base = Math.max(H / img.height, (slotW + Math.abs(ohMax) * 2) / img.width);
  const sc = base * zoom;
  const dw = img.width * sc, dh = img.height * sc;
  const dx = cx - dw / 2 + pan.x;
  const dy = (align === "top" ? 0 : align === "bottom" ? H - dh : H / 2 - dh / 2) + pan.y;
  ctx.drawImage(img, dx, dy, dw, dh);
}
function peelGeo(corner, ps) {
  switch (corner) {
    case "TL": return { C:{x:0,y:0},  A:{x:ps,y:0},   B:{x:0,y:ps},   Cp:{x:ps,y:ps},   hx:ps/2,   hy:ps/2   };
    case "TR": return { C:{x:W,y:0},  A:{x:W-ps,y:0}, B:{x:W,y:ps},   Cp:{x:W-ps,y:ps}, hx:W-ps/2, hy:ps/2   };
    case "BL": return { C:{x:0,y:H},  A:{x:ps,y:H},   B:{x:0,y:H-ps}, Cp:{x:ps,y:H-ps}, hx:ps/2,   hy:H-ps/2 };
    default:   return { C:{x:W,y:H},  A:{x:W-ps,y:H}, B:{x:W,y:H-ps}, Cp:{x:W-ps,y:H-ps},hx:W-ps/2,hy:H-ps/2};
  }
}

// ── Slot ───────────────────────────────────────────────────────────────────────
function Slot({ idx, image, label, selected, align, zoom, pan,
                onSelect, onDrop, onClear, onCycleAlign, onReorder }) {
  const inputRef = useRef();
  const [drag, setDrag] = useState(false);     // file drag-over highlight
  const [dropTarget, setDropTarget] = useState(false); // slot reorder hover
  const isPeel = label === "HIDDEN";
  const AC = { top:"#e0ff4f", center:"#666", bottom:"#60a5fa" };
  const AL = { top:"⬆ TOP",  center:"✛ MID", bottom:"⬇ BOT" };

  const handleFile = async f => {
    if (!f?.type.startsWith("image/")) return;
    onDrop(idx, await fileToDataUrl(f));
  };

  const isSlotDrag = e => e.dataTransfer.types.includes("slot-idx");

  return (
    <div
      // make the whole column draggable for reordering
      draggable
      onDragStart={e => {
        e.dataTransfer.setData("slot-idx", String(idx));
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragEnd={() => setDropTarget(false)}
      // receive other slots being dropped onto this one
      onDragOver={e => {
        e.preventDefault();
        if (isSlotDrag(e)) { e.dataTransfer.dropEffect = "move"; setDropTarget(true); }
        else setDrag(true);
      }}
      onDragLeave={() => { setDrag(false); setDropTarget(false); }}
      onDrop={e => {
        e.preventDefault();
        setDrag(false); setDropTarget(false);
        if (isSlotDrag(e)) {
          const from = parseInt(e.dataTransfer.getData("slot-idx"), 10);
          onReorder(from, idx);
        } else {
          handleFile(e.dataTransfer.files[0]);
        }
      }}
      style={{ flex:1, minWidth:0, cursor:"grab" }}
    >
      <div
        onClick={() => onSelect(idx)}
        onDoubleClick={() => inputRef.current.click()}
        style={{
          position:"relative", height:160, overflow:"hidden",
          borderRadius:4, cursor:"grab",
          display:"flex", alignItems:"center", justifyContent:"center",
          border: dropTarget ? "2px solid #fff"
            : drag ? "2px solid #e0ff4f"
            : selected ? "2px solid #e0ff4f"
            : isPeel && !image ? "2px dashed #a855f7"
            : image ? "2px solid #252525" : "2px dashed #333",
          background: image ? "#000" : isPeel ? "#110a1a" : "#0e0e0e",
          boxShadow: dropTarget ? "0 0 0 2px #ffffff44"
            : selected ? "0 0 0 1px #e0ff4f33" : "none",
          opacity: dropTarget ? 0.7 : 1,
          transition: "opacity .1s, box-shadow .1s",
        }}
      >
        {image ? (
          <>
            <img src={image} alt="" style={{
              position:"absolute", top:"50%", left:"50%",
              width:"100%", height:"100%", objectFit:"cover", pointerEvents:"none",
              transform:`translate(-50%,-50%) translate(${(pan?.x||0)*.08}px,${(pan?.y||0)*.08}px) scale(${zoom||1})`,
            }} />
            {selected && <div style={{ position:"absolute",inset:0,background:"rgba(224,255,79,.07)",pointerEvents:"none" }} />}
            <button onClick={e=>{e.stopPropagation();onCycleAlign(idx);}} style={{
              position:"absolute",top:6,left:6,zIndex:2,
              background:"rgba(0,0,0,.85)",border:"none",borderRadius:3,
              color:AC[align]||"#666",cursor:"pointer",
              padding:"2px 6px",fontSize:11,fontFamily:"inherit",
            }}>{AL[align]||"✛ MID"}</button>
            <button onClick={e=>{e.stopPropagation();onClear(idx);}} style={{
              position:"absolute",top:6,right:6,zIndex:2,
              background:"rgba(0,0,0,.85)",border:"none",borderRadius:3,
              color:"#fff",cursor:"pointer",padding:"2px 7px",fontSize:12,fontFamily:"inherit",
            }}>✕</button>
            <div style={{
              position:"absolute",bottom:0,left:0,right:0,zIndex:2,pointerEvents:"none",
              background:isPeel?"rgba(168,85,247,.72)":"rgba(0,0,0,.62)",
              color:"#fff",fontSize:10,textAlign:"center",padding:"3px 0",
              fontFamily:"inherit",letterSpacing:1,
            }}>{label}</div>
          </>
        ) : (
          <div style={{ textAlign:"center",userSelect:"none",pointerEvents:"none" }}>
            <div style={{ fontSize:24,marginBottom:4,color:isPeel?"#a855f7":"#2e2e2e" }}>{isPeel?"◈":"+"}</div>
            <div style={{ fontSize:10,letterSpacing:1,color:isPeel?"#7c3aed":"#2e2e2e" }}>{label}</div>
            {selected && <div style={{ fontSize:9,color:"#e0ff4f55",marginTop:4,letterSpacing:1 }}>DBL-CLICK OR ⌘V</div>}
          </div>
        )}
        <input ref={inputRef} type="file" accept="image/*" style={{ display:"none" }}
          onChange={e=>handleFile(e.target.files[0])} />
      </div>
    </div>
  );
}

// ── Slash control ──────────────────────────────────────────────────────────────
function SlashCtrl({ index, value, onChange }) {
  return (
    <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:4,minWidth:80 }}>
      <div style={{ fontSize:9,color:"#444",letterSpacing:1 }}>SLASH {index+1}</div>
      <div style={{
        fontSize:18,lineHeight:1,userSelect:"none",
        transform:`rotate(${value}deg)`,transition:"transform .1s",
        color:value===0?"#2e2e2e":value>0?"#e0ff4f":"#60a5fa",
      }}>╱</div>
      <div style={{ fontSize:11,color:"#555",fontVariantNumeric:"tabular-nums",minWidth:36,textAlign:"center" }}>
        {value>0?"+":""}{value}°
      </div>
      <input type="range" min={-25} max={25} step={1} value={value}
        onChange={e=>onChange(index,+e.target.value)}
        style={{ width:80,accentColor:"#e0ff4f" }} />
    </div>
  );
}

// ── App ────────────────────────────────────────────────────────────────────────
export default function StreamSlicer() {
  const [mode,       setMode]       = useState("equal");
  const [slotCount,  setSlotCount]  = useState(3);
  const [images,     setImages]     = useState(Array(4).fill(null));
  const [divAngles,  setDivAngles]  = useState([8, 8, 8]);
  const [aligns,     setAligns]     = useState(["center","center","center","center"]);
  const [zooms,      setZooms]      = useState([1, 1, 1, 1]);
  const [pans,       setPans]       = useState([{x:0,y:0},{x:0,y:0},{x:0,y:0},{x:0,y:0}]);
  const [divW,       setDivW]       = useState(18);
  const [divColor,   setDivColor]   = useState("#ff2020");
  const [peelSize,   setPeelSize]   = useState(220);
  const [peelCorner, setPeelCorner] = useState("BR");
  const [peelCurl,   setPeelCurl]   = useState(0.6);
  const [peelLift,   setPeelLift]   = useState(1.0);  // 0 = flush with fold, 1 = fully extended
  const [outputUrl,  setOutputUrl]  = useState(null);
  const [sel,        setSel]        = useState(0);
  const canvasRef = useRef();

  const n       = mode === "peel" ? 4 : slotCount;
  const nDivs   = mode === "peel" ? 2 : slotCount - 1;
  const active  = images.slice(0, n);
  const filled  = active.every(Boolean);
  const labels  = mode === "peel"
    ? ["GAME 1","GAME 2","GAME 3","HIDDEN"]
    : Array.from({length:n}, (_,i) => `GAME ${i+1}`);

  const setImg      = useCallback((i,u) => setImages(p=>{const a=[...p];a[i]=u;return a;}), []);
  const clrImg      = useCallback((i)   => setImages(p=>{const a=[...p];a[i]=null;return a;}), []);
  const setAngle    = useCallback((i,v) => setDivAngles(p=>{const a=[...p];a[i]=v;return a;}), []);
  const cycleAlign  = useCallback((i)   => setAligns(p=>{const a=[...p];a[i]=a[i]==="center"?"top":a[i]==="top"?"bottom":"center";return a;}), []);
  const setZoom     = useCallback((i,v) => setZooms(p=>{const a=[...p];a[i]=v;return a;}), []);
  const setPan      = useCallback((i,ax,v)=>setPans(p=>{const a=[...p];a[i]={...a[i],[ax]:v};return a;}), []);
  const resetAdj    = useCallback((i)   => {
    setZooms(p=>{const a=[...p];a[i]=1;return a;});
    setPans(p=>{const a=[...p];a[i]={x:0,y:0};return a;});
  }, []);

  // Swap all per-slot state between two indices
  const reorder = useCallback((from, to) => {
    if (from === to) return;
    const swap = arr => { const a=[...arr]; [a[from],a[to]]=[a[to],a[from]]; return a; };
    setImages(swap); setAligns(swap); setZooms(swap); setPans(swap);
    setSel(to); // keep focus on the dragged slot
  }, []);

  // paste
  useEffect(() => {
    const fn = async e => {
      for (const item of (e.clipboardData?.items || [])) {
        if (item.type.startsWith("image/")) {
          const url = await fileToDataUrl(item.getAsFile());
          const t = sel ?? active.findIndex(x=>!x);
          if (t >= 0 && t < n) setImg(t, url);
          break;
        }
      }
    };
    window.addEventListener("paste", fn);
    return () => window.removeEventListener("paste", fn);
  }, [sel, active, n, setImg]);

  // ── render ─────────────────────────────────────────────────────────────────
  // All rendering logic lives INSIDE the effect so it always sees current state
  useEffect(() => {
    if (!filled) { setOutputUrl(null); return; }
    let cancelled = false;

    const run = async () => {
      try {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, W, H);

        const imgs = await Promise.all(active.map(loadImg));
        if (cancelled) return;

        // ── clip coords for slot i in a total-wide layout ──────────────────
        const clipOf = (i, total) => {
          const sw = W / total;
          let lT, lB, rT, rB;
          if (i === 0) { lT = lB = 0; }
          else {
            const d = divX(i * sw, divAngles[i-1]);
            lT = d.top + divW / 2; lB = d.bot + divW / 2;
          }
          if (i === total - 1) { rT = rB = W; }
          else {
            const d = divX((i+1) * sw, divAngles[i]);
            rT = d.top - divW / 2; rB = d.bot - divW / 2;
          }
          return { lT, lB, rT, rB };
        };

        // ── draw slices + dividers ─────────────────────────────────────────
        const drawSlices = (imgArr, total, punch) => {
          const sw = W / total;
          imgArr.forEach((img, i) => {
            const { lT, lB, rT, rB } = clipOf(i, total);
            ctx.save(); ctx.beginPath();
            ctx.moveTo(lT,0); ctx.lineTo(rT,0); ctx.lineTo(rB,H); ctx.lineTo(lB,H);
            if (punch && i === punch.slot) {
              ctx.closePath();
              ctx.moveTo(punch.A.x,punch.A.y);
              ctx.lineTo(punch.B.x,punch.B.y);
              ctx.lineTo(punch.C.x,punch.C.y);
              ctx.closePath(); ctx.clip("evenodd");
            } else { ctx.closePath(); ctx.clip(); }
            const ohL = i>0       ? Math.abs(Math.tan((divAngles[i-1]*Math.PI/180))*H) : 0;
            const ohR = i<total-1 ? Math.abs(Math.tan((divAngles[i]  *Math.PI/180))*H) : 0;
            paintSlot(ctx, img, (i+.5)*sw, sw, Math.max(ohL,ohR), aligns[i], zooms[i], pans[i]);
            ctx.restore();
          });
          for (let d = 0; d < total - 1; d++) {
            const dv = divX((d+1) * W/total, divAngles[d]);
            ctx.save(); ctx.beginPath();
            ctx.moveTo(dv.top-divW/2,0); ctx.lineTo(dv.top+divW/2,0);
            ctx.lineTo(dv.bot+divW/2,H); ctx.lineTo(dv.bot-divW/2,H);
            ctx.closePath(); ctx.fillStyle = divColor; ctx.fill(); ctx.restore();
          }
        };

        if (mode === "equal") {
          drawSlices(imgs, slotCount, null);
        } else {
          const curl = peelCurl;
          // peelLift scales only the fold geometry (hole + flap).
          // The hidden image is always anchored to the full peelSize corner area.
          const ps = peelSize * peelLift;
          const { C, A, B, Cp } = peelGeo(peelCorner, ps);
          const { hx, hy }      = peelGeo(peelCorner, peelSize); // anchor stays at full size
          const punchSlot = (peelCorner === "TL" || peelCorner === "BL") ? 0 : 2;
          const fm = { x:(A.x+B.x)/2, y:(A.y+B.y)/2 };

          // 1. hidden image in reveal triangle
          // Clip to the current (scaled) reveal hole, but scale/position the
          // image relative to the full peelSize corner — so it never shrinks
          // as peelLift changes. Also honour the HIDDEN slot's zoom & pan.
          ctx.save(); ctx.beginPath();
          ctx.moveTo(A.x,A.y); ctx.lineTo(B.x,B.y); ctx.lineTo(C.x,C.y);
          ctx.closePath(); ctx.clip();
          const i4 = imgs[3];
          const sc4 = Math.max(peelSize / i4.width, peelSize / i4.height) * 1.2 * zooms[3];
          const dw4 = i4.width * sc4, dh4 = i4.height * sc4;
          ctx.drawImage(i4, hx - dw4/2 + pans[3].x, hy - dh4/2 + pans[3].y, dw4, dh4);
          ctx.restore();

          // 2. 3 main slices, punch corner out of owning slot
          drawSlices(imgs.slice(0,3), 3, { A, B, C, slot: punchSlot });

          // 3. shadow inside reveal triangle
          ctx.save(); ctx.beginPath();
          ctx.moveTo(A.x,A.y); ctx.lineTo(B.x,B.y); ctx.lineTo(C.x,C.y);
          ctx.closePath(); ctx.clip();
          const sg = ctx.createLinearGradient(fm.x,fm.y,C.x,C.y);
          sg.addColorStop(0, `rgba(0,0,0,${(.2+curl*.5).toFixed(2)})`);
          sg.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = sg; ctx.fillRect(0,0,W,H); ctx.restore();

          // 4. drop shadow under flap
          const sox = W/2 > C.x ?  (2+curl*10) : -(2+curl*10);
          const soy = H/2 > C.y ?  (2+curl*10) : -(2+curl*10);
          ctx.save();
          ctx.shadowColor = "rgba(0,0,0,.55)";
          ctx.shadowBlur = 6 + curl * 22;
          ctx.shadowOffsetX = sox; ctx.shadowOffsetY = soy;
          ctx.beginPath();
          ctx.moveTo(A.x,A.y); ctx.lineTo(B.x,B.y); ctx.lineTo(Cp.x,Cp.y);
          ctx.closePath(); ctx.fillStyle = "rgba(0,0,0,.001)"; ctx.fill();
          ctx.restore();

          // 5. flap face (paper)
          const pd = Math.round(curl * 38);
          ctx.save(); ctx.beginPath();
          ctx.moveTo(A.x,A.y); ctx.lineTo(B.x,B.y); ctx.lineTo(Cp.x,Cp.y);
          ctx.closePath();
          const fg = ctx.createLinearGradient(fm.x,fm.y,Cp.x,Cp.y);
          fg.addColorStop(0,   `rgba(${248-pd},${243-pd},${235-pd},1)`);
          fg.addColorStop(.5,  `rgba(${232-pd},${226-pd},${214-pd},1)`);
          fg.addColorStop(1,   `rgba(${210-pd},${203-pd},${192-pd},1)`);
          ctx.fillStyle = fg; ctx.fill();
          ctx.clip(); ctx.globalAlpha = .02 + curl * .07;
          const yMin = Math.min(A.y,B.y,Cp.y)-10, yMax = Math.max(A.y,B.y,Cp.y)+10;
          const xMin = Math.min(A.x,B.x,Cp.x)-10, xMax = Math.max(A.x,B.x,Cp.x)+10;
          for (let y = yMin; y < yMax; y += 3) {
            ctx.beginPath(); ctx.moveTo(xMin,y); ctx.lineTo(xMax,y);
            ctx.strokeStyle = "#000"; ctx.lineWidth = 1; ctx.stroke();
          }
          ctx.globalAlpha = 1; ctx.restore();

          // 6. fold crease
          ctx.save(); ctx.beginPath();
          ctx.moveTo(A.x,A.y); ctx.lineTo(B.x,B.y);
          ctx.strokeStyle = `rgba(255,255,255,${(.3+curl*.35).toFixed(2)})`;
          ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
        }

        if (!cancelled) setOutputUrl(canvas.toDataURL("image/jpeg", .95));
      } catch(e) { console.error(e); }
    };

    run();
    return () => { cancelled = true; };

  // All state used in render is listed here — no stale closure
  }, [filled, images, mode, slotCount, divAngles, aligns, zooms, pans,
      divW, divColor, peelSize, peelCorner, peelCurl, peelLift]);

  const download = () => {
    if (!outputUrl) return;
    try {
      const a = document.createElement("a");
      a.href = outputUrl; a.download = "stream-thumbnail.jpg";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch { window.open(outputUrl, "_blank"); }
  };

  // ── UI ──────────────────────────────────────────────────────────────────────
  const MBtn = ({ label, active, purple, fn }) => (
    <button onClick={fn} style={{
      height:36, padding:"0 12px", border:"none", borderRadius:3, cursor:"pointer",
      background: active ? (purple?"#a855f7":"#e0ff4f") : "#141414",
      color: active ? "#000" : purple ? "#a855f7" : "#555",
      fontFamily:"inherit", fontSize:purple?11:14, fontWeight:700,
      letterSpacing:purple?1:0, transition:"all .15s",
    }}>{label}</button>
  );

  return (
    <div style={{ minHeight:"100vh", background:"#080808", color:"#ddd",
      fontFamily:"'Courier New',monospace", padding:"28px 24px", boxSizing:"border-box" }}>
      <div style={{ maxWidth:920, margin:"0 auto" }}>

        {/* header */}
        <div style={{ marginBottom:22 }}>
          <div style={{ display:"flex", alignItems:"baseline", gap:12 }}>
            <h1 style={{ margin:0, fontSize:22, color:"#e0ff4f", letterSpacing:3, fontWeight:700 }}>
              STREAM SLICER
            </h1>
            <span style={{ color:"#444", fontSize:12, letterSpacing:2 }}>THUMBNAIL GENERATOR</span>
          </div>
          <div style={{ width:36, height:2, background:"#e0ff4f", marginTop:5 }} />
          <div style={{ marginTop:8, fontSize:9, color:"#444", letterSpacing:1 }}>
            SINGLE CLICK TO SELECT — DOUBLE CLICK TO BROWSE — CTRL+V / ⌘V TO PASTE — ⬆/✛/⬇ CYCLES TOP · MID · BOTTOM CROP
          </div>
        </div>

        {/* top controls */}
        <div style={{ display:"flex", gap:18, marginBottom:18, flexWrap:"wrap", alignItems:"flex-end" }}>

          {/* mode */}
          <div>
            <div style={{ fontSize:9, color:"#555", letterSpacing:2, marginBottom:6 }}>MODE</div>
            <div style={{ display:"flex", gap:4 }}>
              <MBtn label="2" active={mode==="equal"&&slotCount===2} fn={()=>{setMode("equal");setSlotCount(2);}} />
              <MBtn label="3" active={mode==="equal"&&slotCount===3} fn={()=>{setMode("equal");setSlotCount(3);}} />
              <MBtn label="4" active={mode==="equal"&&slotCount===4} fn={()=>{setMode("equal");setSlotCount(4);}} />
              <MBtn label="3+◈" active={mode==="peel"} purple fn={()=>setMode("peel")} />
            </div>
          </div>

          {/* divider width */}
          <div style={{ flex:1, minWidth:90 }}>
            <div style={{ fontSize:9, color:"#555", letterSpacing:2, marginBottom:6 }}>DIVIDER WIDTH — {divW}px</div>
            <input type="range" min={0} max={60} step={2} value={divW}
              onChange={e=>setDivW(+e.target.value)} style={{ width:"100%", accentColor:"#e0ff4f" }} />
          </div>

          {/* peel controls — only in peel mode */}
          {mode === "peel" && (<>
            <div style={{ flex:1, minWidth:80 }}>
              <div style={{ fontSize:9, color:"#a855f7", letterSpacing:2, marginBottom:6 }}>PEEL SIZE — {peelSize}px</div>
              <input type="range" min={80} max={380} step={10} value={peelSize}
                onChange={e=>setPeelSize(+e.target.value)} style={{ width:"100%", accentColor:"#a855f7" }} />
            </div>
            <div style={{ flex:1, minWidth:80 }}>
              <div style={{ fontSize:9, color:"#a855f7", letterSpacing:2, marginBottom:6 }}>CURL — {Math.round(peelCurl*100)}%</div>
              <input type="range" min={0} max={1} step={0.01} value={peelCurl}
                onChange={e=>setPeelCurl(+e.target.value)} style={{ width:"100%", accentColor:"#a855f7" }} />
            </div>
            <div style={{ flex:1, minWidth:80 }}>
              <div style={{ fontSize:9, color:"#a855f7", letterSpacing:2, marginBottom:6 }}>PEEL AMOUNT — {Math.round(peelLift*100)}%</div>
              <input type="range" min={0.05} max={1} step={0.01} value={peelLift}
                onChange={e=>setPeelLift(+e.target.value)} style={{ width:"100%", accentColor:"#a855f7" }} />
            </div>
            <div>
              <div style={{ fontSize:9, color:"#a855f7", letterSpacing:2, marginBottom:6 }}>CORNER</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:3, width:72 }}>
                {[{id:"TL",s:"◤"},{id:"TR",s:"◥"},{id:"BL",s:"◣"},{id:"BR",s:"◢"}].map(({id,s})=>(
                  <button key={id} onClick={()=>setPeelCorner(id)} style={{
                    height:28, border:"none", borderRadius:3, cursor:"pointer", fontSize:14,
                    background:peelCorner===id?"#a855f7":"#141414",
                    color:peelCorner===id?"#000":"#a855f7",
                    transition:"all .15s",
                  }}>{s}</button>
                ))}
              </div>
            </div>
          </>)}

          {/* divider color */}
          <div>
            <div style={{ fontSize:9, color:"#555", letterSpacing:2, marginBottom:6 }}>DIVIDER COLOR</div>
            <div style={{ display:"flex", alignItems:"center", gap:7 }}>
              <input type="color" value={divColor} onChange={e=>setDivColor(e.target.value)}
                style={{ width:36, height:36, border:"2px solid #1e1e1e", borderRadius:3, padding:2, background:"none", cursor:"pointer" }} />
              <span style={{ fontSize:10, color:"#444" }}>{divColor.toUpperCase()}</span>
            </div>
          </div>
        </div>

        {/* slash angles */}
        <div style={{ marginBottom:18, padding:"12px 16px", background:"#0d0d0d", border:"1px solid #191919", borderRadius:4 }}>
          <div style={{ fontSize:9, color:"#444", letterSpacing:2, marginBottom:12 }}>SLASH ANGLES (–25° TO +25°)</div>
          <div style={{ display:"flex", gap:28, flexWrap:"wrap" }}>
            {nDivs === 0
              ? <div style={{ fontSize:9, color:"#222" }}>NO DIVIDERS</div>
              : Array.from({length:nDivs}).map((_,d) => (
                  <SlashCtrl key={d} index={d} value={divAngles[d]} onChange={setAngle} />
                ))
            }
          </div>
        </div>

        {/* slots */}
        <div style={{ display:"flex", gap:8, marginBottom:14 }}>
          {Array.from({length:n}).map((_,i) => (
            <Slot key={i} idx={i} image={images[i]} label={labels[i]}
              selected={sel===i} align={aligns[i]} zoom={zooms[i]} pan={pans[i]}
              onSelect={setSel} onDrop={setImg} onClear={clrImg}
              onCycleAlign={cycleAlign} onReorder={reorder} />
          ))}
        </div>

        {/* per-slot adjust */}
        {images[sel] && (
          <div style={{ marginBottom:14, padding:"12px 16px", background:"#0d1a0d", border:"1px solid #1a3a1a", borderRadius:4 }}>
            <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:12 }}>
              <span style={{ fontSize:9, color:"#3a7a3a", letterSpacing:2 }}>ADJUST — {labels[sel]}</span>
              <button onClick={()=>resetAdj(sel)} style={{
                background:"none", border:"1px solid #1a3a1a", color:"#3a5a3a",
                borderRadius:3, cursor:"pointer", padding:"2px 8px", fontSize:9, fontFamily:"inherit",
              }}>RESET</button>
            </div>
            <div style={{ display:"flex", gap:20, flexWrap:"wrap" }}>
              {[
                { label:`ZOOM — ${zooms[sel].toFixed(2)}×`, min:1, max:4, step:.01, val:zooms[sel], fn:v=>setZoom(sel,v) },
                { label:`PAN X — ${pans[sel].x>0?"+":""}${pans[sel].x}px`, min:-600, max:600, step:1, val:pans[sel].x, fn:v=>setPan(sel,"x",v) },
                { label:`PAN Y — ${pans[sel].y>0?"+":""}${pans[sel].y}px`, min:-400, max:400, step:1, val:pans[sel].y, fn:v=>setPan(sel,"y",v) },
              ].map(({label,min,max,step,val,fn}) => (
                <div key={label} style={{ flex:1, minWidth:130 }}>
                  <div style={{ fontSize:9, color:"#2a5a2a", letterSpacing:2, marginBottom:6 }}>{label}</div>
                  <input type="range" min={min} max={max} step={step} value={val}
                    onChange={e=>fn(+e.target.value)} style={{ width:"100%", accentColor:"#4ade80" }} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* peel hint */}
        {mode === "peel" && (
          <div style={{ marginBottom:14, padding:"8px 12px", background:"#0f0a1a", border:"1px solid #25114a", borderRadius:3, fontSize:9, color:"#7c3aed", letterSpacing:1 }}>
            ◈  HIDDEN slot peeks through the selected corner. SIZE sets the maximum peel extent, PEEL AMOUNT sets how far it's lifted (25% = barely peeled, 100% = fully peeled), CURL adjusts shadow and paper shading.
          </div>
        )}

        {/* preview */}
        <div style={{ background:"#0d0d0d", border:"1px solid #191919", borderRadius:4, overflow:"hidden", marginBottom:14 }}>
          {outputUrl
            ? <img src={outputUrl} alt="preview" style={{ width:"100%", display:"block" }} />
            : <div style={{ height:160, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:8 }}>
                <div style={{ fontSize:24, color:"#1e1e1e" }}>⬛</div>
                <div style={{ fontSize:10, color:"#2a2a2a", letterSpacing:2 }}>FILL ALL {n} SLOTS TO PREVIEW</div>
              </div>
          }
        </div>

        {/* export */}
        <div style={{ display:"flex", gap:12, alignItems:"center", flexWrap:"wrap" }}>
          <button onClick={download} disabled={!outputUrl} style={{
            background:outputUrl?"#e0ff4f":"#141414", color:outputUrl?"#000":"#2e2e2e",
            border:"none", borderRadius:3, padding:"10px 24px",
            fontFamily:"inherit", fontSize:12, letterSpacing:2, fontWeight:700,
            cursor:outputUrl?"pointer":"not-allowed", transition:"all .15s",
          }}>↓ EXPORT JPEG</button>
          <span style={{ fontSize:9, color:"#333", letterSpacing:1 }}>{W} × {H}px</span>
          {outputUrl && (
            <span style={{ fontSize:9, color:"#3a3a3a", letterSpacing:1 }}>
              — or right-click the preview → Save Image As
            </span>
          )}
        </div>

        <canvas ref={canvasRef} style={{ display:"none" }} />
      </div>
    </div>
  );
}
