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
import ZoomableComponent from "../components/zoom/ZoomableComponent";
import useArtboardStore from "../store/ArtboardStore";
import { useQuery } from "@tanstack/react-query";
import { getAllShapesQueryOptions } from "../lib/api/shapes";
import type { Wireframe } from "../../../interfaces/artboard";

export type DragDelta = { x: number; y: number };

export type ActiveDragState = {
  pageId: string | null;
  primaryShapeId?: string | null;
  delta: DragDelta;
  selectedShapeIds: string[];
};

export type Bounds = ReturnType<typeof getBoundsForShape>;

export function getBoundsForShape(shape: Wireframe) {
  return {
    leftBound: shape.xOffset,
    rightBound: shape.xOffset + shape.width,
    topBound: shape.yOffset,
    bottomBound: shape.yOffset + shape.height,
  };
}

export function isInBoundsOfOuterShape(outerShape: Bounds, innerShape: Bounds) {
  const result =
    outerShape.topBound < innerShape.topBound &&
    outerShape.bottomBound > innerShape.bottomBound &&
    outerShape.leftBound < innerShape.leftBound &&
    outerShape.rightBound > innerShape.rightBound;
  return result;
}

export function isShapeInPage(shape: Wireframe, page: Wireframe) {
  return isInBoundsOfOuterShape(
    getBoundsForShape(page),
    getBoundsForShape(shape)
  );
}

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
  const { isHandToolActive } = useArtboardStore();
  const { data: shapes } = useQuery(getAllShapesQueryOptions());
  const [demoShapes, setDemoShapes] = useState([
    {
      id: "a",
      xOffset: 400,
      yOffset: 200,
      width: 100,
      height: 50,
      type: "button",
    },
    {
      id: "b",
      xOffset: 600,
      yOffset: 400,
      width: 100,
      height: 50,
      type: "text",
    },
  ]);
  const [isDraggingGroup, setIsDraggingGroup] = useState(false);
  const activeDraggingId = useRef<string | null>(null);

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

  const [componentPositions, setComponentPositions] = useState<
    Record<string, { x: number; y: number }>
  >({
    a: { x: 400, y: 200 },
    b: { x: 600, y: 400 },
  });

  function handleMouseDown(e: React.MouseEvent) {
    if (e.target !== containerRef.current) return;
    setStartPos({ x: e.clientX, y: e.clientY });
    setSelectBox({
      x: e.clientX,
      y: e.clientY,
      width: 0,
      height: 0,
    });

    // Clear selection if clicking on the background
    if (!e.ctrlKey && !e.metaKey) {
      setSelectedIds([]);
    }
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

  function handleGroupDrag(id: string, deltaX: number, deltaY: number) {
    if (selectedIds.includes(id)) {
      // Update positions in demoShapes directly
      setDemoShapes((prevShapes) =>
        prevShapes.map((shape) => {
          // Only update selected shapes
          if (selectedIds.includes(shape.id)) {
            return {
              ...shape,
              xOffset: shape.xOffset + deltaX,
              yOffset: shape.yOffset + deltaY,
            };
          }
          return shape;
        })
      );
    }
  }

  function handleComponentClick(id: string, e: React.MouseEvent) {
    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      setSelectedIds((prev) =>
        prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
      );
    } else {
      if (!selectedIds.includes(id)) {
        setSelectedIds([id]);
      }
    }
  }

  const updateRef = (id: string, ref: HTMLDivElement | null) => {
    componentRefs.current[id] = ref;
  };

  // Group drag functionality
  // Store the initial positions when starting a group drag
  const initialPositions = useRef<Record<string, { x: number; y: number }>>({});

  const handleDragStart = (id: string, x: number, y: number) => {
    // Just store the initial positions of selected shapes
    const positions: Record<string, { x: number; y: number }> = {};

    selectedIds.forEach((shapeId) => {
      const shape = demoShapes.find((s) => s.id === shapeId);
      if (shape) {
        positions[shapeId] = {
          x: shape.xOffset,
          y: shape.yOffset,
        };
      }
    });

    initialPositions.current = positions;
    activeDraggingId.current = id;
  };

  const handleDrag = (id: string, dx: number, dy: number) => {
    // For individual drag operations - update just the dragged shape
    if (!selectedIds.includes(id) || selectedIds.length === 1) {
      setDemoShapes((prevShapes) =>
        prevShapes.map((shape) =>
          shape.id === id
            ? {
                ...shape,
                xOffset: initialPositions.current[id]?.x + dx || shape.xOffset,
                yOffset: initialPositions.current[id]?.y + dy || shape.yOffset,
              }
            : shape
        )
      );
    }
  };

  // Update the main state when single shapes are moved
  const updateShapePosition = (id: string, newX: number, newY: number) => {
    setDemoShapes((prevShapes) =>
      prevShapes.map((shape) =>
        shape.id === id ? { ...shape, xOffset: newX, yOffset: newY } : shape
      )
    );
  };

  const handleDragEnd = (id: string) => {
    // Get the shape's DOM element
    const shapeElement = componentRefs.current[id];

    if (isDraggingGroup) {
      // For group drag, we need to calculate the final delta from the dragged element
      const draggedShape = demoShapes.find((shape) => shape.id === id);
      if (draggedShape && shapeElement) {
        const rect = shapeElement.getBoundingClientRect();

        // Calculate the actual movement delta from initial position
        const initialPos = initialPositions.current[id] || {
          x: draggedShape.xOffset,
          y: draggedShape.yOffset,
        };
        const finalDeltaX = rect.left - initialPos.x;
        const finalDeltaY = rect.top - initialPos.y;

        // Update all shapes in the group using the same delta
        setDemoShapes((prevShapes) =>
          prevShapes.map((shape) => {
            if (selectedIds.includes(shape.id)) {
              // Get initial position with fallback to current position
              const shapeInitialPos = initialPositions.current[shape.id] || {
                x: shape.xOffset,
                y: shape.yOffset,
              };
              return {
                ...shape,
                xOffset: shapeInitialPos.x + finalDeltaX,
                yOffset: shapeInitialPos.y + finalDeltaY,
              };
            }
            return shape;
          })
        );
      }
    } else {
      // Single shape drag - update just this shape's position
      if (shapeElement) {
        const rect = shapeElement.getBoundingClientRect();
        updateShapePosition(id, rect.left, rect.top);
      }
    }

    // Clean up
    initialPositions.current = {};
    setIsDraggingGroup(false);
    activeDraggingId.current = null;
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
      <ZoomableComponent
        panning={isHandToolActive}
        shapes={shapes ? shapes : []}
      >
        <div>
          {demoShapes.map((shape) => (
            <ResizeAndDrag
              key={shape.id}
              id={shape.id}
              isSelected={selectedIds.includes(shape.id)}
              onRefUpdate={updateRef}
              x={shape.xOffset}
              y={shape.yOffset}
              width={shape.width}
              height={shape.height}
              selectedIds={selectedIds}
              setSelectedIds={setSelectedIds}
              onDragStart={handleDragStart}
              onDrag={handleDrag}
              onDragEnd={handleDragEnd}
              onClick={handleComponentClick}
              onGroupDrag={handleGroupDrag}
              position={{ x: shape.xOffset, y: shape.yOffset }}
            >
              {shape.type == "button" ? (
                <div className="relative w-full h-full flex items-center flex-col text-left rounded justify-center bg-white text-black [container-type:size]">
                  <button className="pointer-events-auto">BUTTON</button>
                </div>
              ) : shape.type == "text" ? (
                <div>SOME TEXT</div>
              ) : (
                ""
              )}
            </ResizeAndDrag>
          ))}
        </div>
      </ZoomableComponent>

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
