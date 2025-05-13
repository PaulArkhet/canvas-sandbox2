import {
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { MouseEvent as ReactMouse, WheelEvent as ReactWheel } from "react";
import { ViewContext } from "./ViewContext";
import useArtboardStore from "../../store/ArtboardStore";
import type { Wireframe } from "../../../../interfaces/artboard";
import React from "react";

export function zoomAt(
  wrapper: React.RefObject<HTMLDivElement>,
  scaleAt: (p: { x: number; y: number }, f: number) => void,
  factor: number
) {
  const r = wrapper.current?.getBoundingClientRect();
  if (!r) return;
  const cx = window.scrollX + innerWidth / 2;
  const cy = window.scrollY + innerHeight / 2;
  scaleAt(
    { x: cx - r.left + window.scrollX, y: cy - r.top + window.scrollY },
    factor
  );
}

interface Props {
  children: React.JSX.Element;
  panning: boolean;
  shapes: Wireframe[];
}

export default function ZoomableComponent({
  children,
  panning,
  shapes,
}: Props) {
  /* ---------------------------------------------------------------- *
   *  ── Context wiring                                               *
   * ---------------------------------------------------------------- */
  const ctx = useContext(ViewContext);
  if (!ctx) throw new Error("ZoomableComponent must be inside <ViewProvider>");

  /* subscribe only to SCALE – the snapshot is *just a number*        */
  const scale = useSyncExternalStore(
    ctx.subscribe,
    () => ctx.getSnapshot().scale
  );

  /* ---------------------------------------------------------------- *
   *  Refs & local state                                              *
   * ---------------------------------------------------------------- */
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null); // element we transform
  const mouse = useRef({ x: 0, y: 0 });
  const isPanning = useRef(false);

  /* marquee‑selection state --------------------------------------- */
  const [box, setBox] = useState({
    active: false,
    startX: 0,
    startY: 0,
    x: 0,
    y: 0,
    w: 0,
    h: 0,
  });

  const { setWrapperRef, setSelectedShapeIds } = useArtboardStore();

  /* ---------------------------------------------------------------- *
   *  IMPERATIVE: we keep the canvas transform in sync ourselves       *
   * ---------------------------------------------------------------- */
  const applyTransform = () => {
    const el = canvasRef.current;
    if (!el) return;

    const { x, y } = ctx.pos.current;
    const s = ctx.getSnapshot().scale; // ← fresh value every call
    el.style.transform = `matrix(${s},0,0,${s},${x},${y})`;
  };

  /* update transform on every scale change (pos change is done inside pan) */
  useLayoutEffect(applyTransform, [scale]);

  /* ---------------------------------------------------------------- *
   *  Wheel‑panning (no ctrl/meta)                                    *
   * ---------------------------------------------------------------- */
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return; // pinch gesture
      ctx.pan({
        x: e.shiftKey ? -e.deltaY : -e.deltaX,
        y: e.shiftKey ? 0 : -e.deltaY,
      });
      applyTransform();
      e.preventDefault();
    };
    wrapper.addEventListener("wheel", onWheel, { passive: false });
    return () => wrapper.removeEventListener("wheel", onWheel);
  }, [ctx.pan]);

  /* expose the wrapper to zustand so other parts can query bounds    */
  //@ts-ignore
  useEffect(() => setWrapperRef(wrapperRef), [setWrapperRef]);

  /* ---------------------------------------------------------------- *
   *  Keyboard zoom                                                   *
   * ---------------------------------------------------------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      if (e.key !== "=" && e.key !== "-") return;
      //@ts-ignore
      zoomAt(wrapperRef, ctx.scaleAt, e.key === "=" ? 1.05 : 1 / 1.05);
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ctx.scaleAt]);

  /* ---------------------------------------------------------------- *
   *  Mouse handlers (pan & marquee)                                  *
   * ---------------------------------------------------------------- */
  const onMouseDown = (e: ReactMouse<HTMLDivElement>) => {
    if (panning) {
      /* -------- start panning ------- */
      isPanning.current = true;
      mouse.current = { x: e.clientX, y: e.clientY };
      e.preventDefault();
      return;
    }

    /* -------- start marquee selection ---------------------------- */
    const target = e.target as HTMLElement;

    const isShape =
      !(
        (target instanceof HTMLElement &&
          target.classList.contains("mouse-follow")) ||
        (target instanceof HTMLElement &&
          target.classList.contains("bg-opacity-75"))
      ) && !target.classList.contains("not-shape"); // hacky way to detect a canvas or page click;

    if (isShape) {
      console.log("returning earlyh because isShape");
      console.log(target.classList);
      return;
    }

    const rect = wrapperRef.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    setBox({ active: true, startX: sx, startY: sy, x: sx, y: sy, w: 0, h: 0 });
    e.preventDefault();
  };

  const onMouseMove = (e: ReactMouse<HTMLDivElement>) => {
    if (isPanning.current) {
      ctx.pan({
        x: e.clientX - mouse.current.x,
        y: e.clientY - mouse.current.y,
      });
      applyTransform();
      mouse.current = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    }
    if (box.active) {
      const rect = wrapperRef.current!.getBoundingClientRect();
      const ex = e.clientX - rect.left;
      const ey = e.clientY - rect.top;
      setBox((b) => ({
        ...b,
        x: Math.min(b.startX, ex),
        y: Math.min(b.startY, ey),
        w: Math.abs(ex - b.startX),
        h: Math.abs(ey - b.startY),
      }));
    }
  };

  const finish = () => {
    isPanning.current = false;

    if (!box.active) return;
    /* --- compute selected IDs ----------------------------------- */
    setTimeout(() => {
      const selectedShapes: Wireframe[] = shapes.filter((shape: any) => {
        if (shape.type === "page") return;
        const x = shape.xOffset;
        const y = shape.yOffset;
        const { width, height } = shape;

        return (
          x + width > (box.x - ctx.pos.current.x) / scale + 1000 &&
          x < (box.x + box.w - ctx.pos.current.x) / scale + 1000 &&
          y + height > (box.y - ctx.pos.current.y) / scale + 1000 &&
          y < (box.y + box.h - ctx.pos.current.y) / scale + 1000
        );
      });

      const shapeIds = selectedShapes.map((shape) => shape.id);
      setSelectedShapeIds(new Set(shapeIds));
    }, 0);

    setBox((b) => ({ ...b, active: false }));
  };

  /* ---------------------------------------------------------------- *
   *  Ctrl‑wheel zoom (around pointer)                                *
   * ---------------------------------------------------------------- */
  const onWheelZoom = (e: ReactWheel<HTMLDivElement>) => {
    if (!e.ctrlKey && !e.metaKey) return;
    const rect = wrapperRef.current!.getBoundingClientRect();
    const factor = e.deltaY < 0 ? 1.02 : 1 / 1.02;
    ctx.scaleAt({ x: e.clientX - rect.left, y: e.clientY - rect.top }, factor);
    applyTransform(); // scale changed ⇒ update immediately
    e.preventDefault();
  };

  /* ---------------------------------------------------------------- *
   *  Render                                                          *
   * ---------------------------------------------------------------- */
  return (
    <div
      ref={wrapperRef}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={finish}
      onMouseLeave={finish}
      onWheel={onWheelZoom}
      className={`${isPanning.current ? "cursor-grab" : "arkhet-cursor"} touch-none w-fit h-fit`}
    >
      <div id="zoomable-canvas" ref={canvasRef}>
        {children}
      </div>

      {box.active && (
        <div
          className="absolute border border-purple-200 bg-purple-500 opacity-10 pointer-events-none"
          style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
        />
      )}
    </div>
  );
}
