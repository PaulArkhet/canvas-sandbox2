import { createFileRoute } from "@tanstack/react-router";
import ResizeAndDrag from "../components/ResizeAndDrag";
import LeftNav from "../components/LeftNav";
import TopNav from "../components/TopNav";
import RightNav from "../components/RightNav";
import {
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { ZoomBadge } from "../components/zoom/ZoomBadge";
import { ViewContext } from "../components/zoom/ViewContext";
import ZoomableComponent from "../components/zoom/ZoomableComponent";
import useArtboardStore from "../store/ArtboardStore";
import { useQuery } from "@tanstack/react-query";
import {
  getAllShapesQueryOptions,
  useCreateShapeMutation,
  useShapeBatchOperations,
} from "../lib/api/shapes";
import type { Wireframe } from "../../../interfaces/artboard";
import { MemoCanvas } from "../components/Canvas";
import { useDeleteMultipagePathMutation } from "../lib/api/multipage-paths";

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

function moveLayer(
  objects: Wireframe[],
  selectedIds: Set<string>,
  direction: "up" | "down" | "front" | "back"
): Wireframe[] {
  const objectsCopy = [...objects];

  const selectedObjects = objectsCopy.filter((obj) => selectedIds.has(obj.id));
  if (selectedObjects.length === 0) {
    return objects;
  }

  const pages = objectsCopy.filter((shape) => shape.type === "page");
  const pageIds = new Set(pages.map((page) => page.id));

  const parentPageMap = new Map<string, string | null>();

  selectedObjects.forEach((selectedObj) => {
    if (pageIds.has(selectedObj.id)) {
      parentPageMap.set(selectedObj.id, null);
      return;
    }

    const selectedBounds = getBoundsForShape(selectedObj);

    for (const page of pages) {
      const pageBounds = getBoundsForShape(page);
      if (isInBoundsOfOuterShape(pageBounds, selectedBounds)) {
        parentPageMap.set(selectedObj.id, page.id);
        break;
      }
    }

    if (!parentPageMap.has(selectedObj.id)) {
      parentPageMap.set(selectedObj.id, null);
    }
  });

  const sortedObjects = [...objectsCopy].sort((a, b) => a.zIndex - b.zIndex);

  if (direction === "front") {
    let maxZIndex = Math.max(...sortedObjects.map((obj) => obj.zIndex));

    return sortedObjects.map((obj) => {
      if (selectedIds.has(obj.id)) {
        return { ...obj, zIndex: ++maxZIndex };
      }
      return { ...obj };
    });
  } else if (direction === "back") {
    const minZIndices = new Map<string, number>();

    selectedObjects.forEach((obj) => {
      const parentPageId = parentPageMap.get(obj.id);

      if (parentPageId) {
        const parentPage = sortedObjects.find((p) => p.id === parentPageId);
        if (parentPage) {
          minZIndices.set(obj.id, parentPage.zIndex + 1);
        } else {
          minZIndices.set(obj.id, 0);
        }
      } else {
        minZIndices.set(obj.id, 0);
      }
    });

    const nonSelectedObjects = sortedObjects.filter(
      (obj) => !selectedIds.has(obj.id)
    );

    let result = [...nonSelectedObjects];

    selectedObjects.forEach((obj) => {
      const minZIndex = minZIndices.get(obj.id) || 0;

      let insertIndex = 0;
      while (
        insertIndex < result.length &&
        result[insertIndex].zIndex < minZIndex
      ) {
        insertIndex++;
      }

      result.splice(insertIndex, 0, obj);
    });

    return result.map((obj, idx) => ({
      ...obj,
      zIndex: idx,
    }));
  } else {
    const offset = direction === "up" ? 1 : -1;

    const newPositions = new Map(
      sortedObjects.map((obj, index) => [
        obj.id,
        selectedIds.has(obj.id) ? index + offset : index,
      ])
    );

    for (const [id, pos] of newPositions.entries()) {
      if (selectedIds.has(id)) {
        const parentPageId = parentPageMap.get(id);

        if (parentPageId) {
          const parentPageIndex = sortedObjects.findIndex(
            (obj) => obj.id === parentPageId
          );

          if (parentPageIndex !== -1 && pos <= parentPageIndex) {
            newPositions.set(id, parentPageIndex + 1);
          }
        }
      }
    }

    const clampedPositions = new Map(
      [...newPositions.entries()].map(([id, pos]) => [
        id,
        Math.max(0, Math.min(pos, sortedObjects.length - 1)),
      ])
    );

    const reorderedObjects = [...sortedObjects];
    for (const [id, newPos] of clampedPositions.entries()) {
      if (selectedIds.has(id)) {
        const objIndex = reorderedObjects.findIndex((obj) => obj.id === id);
        const [obj] = reorderedObjects.splice(objIndex, 1);
        reorderedObjects.splice(newPos, 0, obj);
      }
    }

    return reorderedObjects.map((obj, idx) => ({
      ...obj,
      zIndex: idx,
    }));
  }
}

export const Route = createFileRoute("/")({
  component: RouteComponent,
});

function RouteComponent() {
  const {
    setDebugPath,
    isHandToolActive,
    toggleHandTool,
    setIsHandToolActive,
    handleTimeTravel,
    selectedShapeIds,
    clearSelection,
  } = useArtboardStore();
  const { data: shapes } = useQuery(getAllShapesQueryOptions());
  const { mutate: deletePermanentPath } = useDeleteMultipagePathMutation();
  const { mutate: handleAddShape } = useCreateShapeMutation();
  const { updateShapes } = useShapeBatchOperations();
  const [isAltKeyPressed, setIsAltKeyPressed] = useState(false);
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
  const [demoShapes, setDemoShapes] = useState([
    {
      id: "a",
      xOffset: 1400,
      yOffset: 1200,
      width: 100,
      height: 50,
      type: "button",
    },
    {
      id: "b",
      xOffset: 1600,
      yOffset: 1400,
      width: 100,
      height: 50,
      type: "text",
    },
  ]);
  const [isDraggingGroup, setIsDraggingGroup] = useState(false);
  const activeDraggingId = useRef<string | null>(null);
  const pageRefList = useRef<HTMLDivElement[]>([]);
  const allShapesRefList = useRef<HTMLDivElement[]>([]);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [canvasPosition, setCanvasPosition] = useState({
    x: -1000,
    y: -1000,
  });
  const activeDragRef = useRef<ActiveDragState>({
    pageId: null,
    delta: { x: 0, y: 0 },
    selectedShapeIds: [],
  });
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
  } | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(
    null
  );

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

  function handleMouseDown(event: React.MouseEvent) {
    if (isHandToolActive || event.button === 1) {
      setDragStart({ x: event.clientX, y: event.clientY });
    }
  }

  function handleMouseMove(event: React.MouseEvent) {
    if (isHandToolActive && dragStart) {
      const dx = event.clientX - dragStart.x;
      const dy = event.clientY - dragStart.y;
      setCanvasPosition((prevPosition) => ({
        x: prevPosition.x + dx / 2,
        y: prevPosition.y + dy / 2,
      }));
      setDragStart({ x: event.clientX, y: event.clientY });
    }
  }

  function handleMouseUp() {
    setDragStart(null);
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

  function handleCanvasClick(event: React.MouseEvent) {
    // Deselect any selected shape when clicking on the canvas
    const isMultipageHandle =
      event.target instanceof HTMLElement &&
      event.target.classList.contains("multipage-handle");
    const isShape = !(
      event.target instanceof HTMLElement &&
      event.target.classList.contains("mouse-follow")
    ); // hacky way to detect a canvas click;
    if (isMultipageHandle || isShape) {
      return;
    }
    clearSelection();
    setDebugPath(null);
  }

  function handleContextMenu(event: React.MouseEvent<HTMLDivElement>) {
    event.preventDefault();
    setContextMenu({ visible: true, x: event.clientX, y: event.clientY });
  }

  const memoisedCanvas = useMemo(
    () => (
      <MemoCanvas
        shapes={shapes}
        pageRefList={pageRefList}
        allShapesRefList={allShapesRefList}
        canvasRef={canvasRef}
        canvasPosition={canvasPosition}
        isHandToolActive={isHandToolActive}
        handleMouseDown={handleMouseDown}
        handleMouseMove={handleMouseMove}
        handleMouseUp={handleMouseUp}
        handleCanvasClick={handleCanvasClick}
        handleContextMenu={handleContextMenu}
        isAltKeyPressed={isAltKeyPressed}
        activeDragRef={activeDragRef}
      />
    ),
    [
      scale,
      shapes,
      allShapesRefList,
      canvasRef,
      canvasPosition,
      isHandToolActive,
      isAltKeyPressed,
      activeDragRef,
    ]
  );

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
        {memoisedCanvas}
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
      <LeftNav canvasRef={canvasRef} />
      <TopNav />
      <RightNav />
    </div>
  );
}
