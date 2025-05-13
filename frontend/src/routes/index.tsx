import { createFileRoute } from "@tanstack/react-router";
import ResizeAndDrag from "../components/ResizeAndDrag";
import LeftNav from "../components/LeftNav";
import TopNav from "../components/TopNav";
import RightNav from "../components/RightNav";
import {
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { ZoomBadge } from "../components/zoom/ZoomBadge";
import { ViewContext } from "../components/zoom/ViewContext";

export type DragDelta = { x: number; y: number };

export type ActiveDragState = {
  pageId: string | null;
  primaryShapeId?: string | null;
  delta: DragDelta;
  selectedShapeIds: string[];
};

export const Route = createFileRoute("/")({
  component: RouteComponent,
});

function RouteComponent() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectBox, setSelectBox] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(
    null
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const componentRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const ctx = useContext(ViewContext)!;

  useEffect(() => {
    return () => {
      ctx.setScale(1);
      ctx.pos.current = { x: 0, y: 0 };
    };
  }, []);

  const scale = useSyncExternalStore(
    ctx?.subscribe ?? (() => () => {}),
    () => ctx?.getSnapshot().scale ?? 1
  );

  function handleMouseDown(e: React.MouseEvent) {
    if (e.target !== containerRef.current) return;
    setStartPos({ x: e.clientX, y: e.clientY });
    setSelectBox({
      x: e.clientX,
      y: e.clientY,
      width: 0,
      height: 0,
    });
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!startPos) return;
    const x = Math.min(startPos.x, e.clientX);
    const y = Math.min(startPos.y, e.clientY);
    const width = Math.abs(e.clientX - startPos.x);
    const height = Math.abs(e.clientY - startPos.y);
    setSelectBox({ x, y, width, height });
  }

  function handleMouseUp() {
    if (!selectBox) return;
    const selected: string[] = [];

    Object.entries(componentRefs.current).forEach(([id, el]) => {
      if (!el) return;
      const rect = el.getBoundingClientRect();

      const intersects =
        rect.right > selectBox.x &&
        rect.left < selectBox.x + selectBox.width &&
        rect.bottom > selectBox.y &&
        rect.top < selectBox.y + selectBox.height;

      if (intersects) selected.push(id);
    });

    setSelectedIds(selected);
    setStartPos(null);
    setSelectBox(null);
  }

  const updateRef = (id: string, ref: HTMLDivElement | null) => {
    componentRefs.current[id] = ref;
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      className="flex flex-col min-h-screen bg-[#2c2c2c] relative text-white"
    >
      <ZoomBadge />
      <ResizeAndDrag
        id="a"
        isSelected={selectedIds.includes("a")}
        onRefUpdate={updateRef}
        x={400}
        y={200}
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
        width={100}
        height={50}
      >
        <div className="relative w-full h-full flex items-center flex-col text-left rounded justify-center bg-white text-black [container-type:size]">
          <button className="pointer-events-auto">BUTTON</button>
        </div>
      </ResizeAndDrag>
      <ResizeAndDrag
        id="b"
        isSelected={selectedIds.includes("b")}
        onRefUpdate={updateRef}
        x={600}
        y={400}
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
        width={100}
        height={50}
      >
        <div>SOME TEXT</div>
      </ResizeAndDrag>
      {selectBox && (
        <div
          className="absolute border border-purple-200 bg-purple-500 opacity-10 pointer-events-none"
          style={{
            left: selectBox.x,
            top: selectBox.y,
            width: selectBox.width,
            height: selectBox.height,
          }}
        />
      )}
      <LeftNav />
      <TopNav />
      <RightNav />
    </div>
  );
}
