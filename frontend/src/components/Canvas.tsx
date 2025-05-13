import {
  useContext,
  useRef,
  useState,
  memo,
  useSyncExternalStore,
  useEffect,
} from "react";
import type { MutableRefObject } from "react";
import useArtboardStore from "../store/ArtboardStore";
import type { Wireframe, PermanentPath } from "../../../interfaces/artboard";
import { MemoDragAndDrop, setupArtboardTree } from "./DragAndDropComponent";
import { ViewContext } from "./zoom/ViewContext";
import { Socket } from "socket.io-client";
import { twMerge } from "tailwind-merge";
import { GlobalPathSegments } from "./GlobalPathSegments";
import { findOrthogonalPath } from "../lib/orthogonal-finder";
import { getMultipageHandlePoint } from "./MultipageHandles";
import { useQuery } from "@tanstack/react-query";
import { getMultipagePathsQueryOptions } from "../lib/api/multipage-paths";
import type { ActiveDragState } from "../routes/index";
import { useBatchUpdateShapesMutation } from "../lib/api/shapes";
import { useShallow } from "zustand/react/shallow";

export const GRID_SIZE_PIXELS = 5;

export function Canvas({
  shapes,
  pageRefList,
  allShapesRefList,
  canvasRef,
  isHandToolActive,
  handleMouseDown,
  handleMouseMove,
  handleMouseUp,
  handleCanvasClick,
  code,
  socket,
  handleContextMenu,
  isPrototypeReady,
  isAltKeyPressed,
  activeDragRef,
}: {
  code?: string;
  socket?: Socket;
  shapes: Wireframe[] | undefined;
  canvasPosition: { x: number; y: number };
  pageRefList?: MutableRefObject<HTMLDivElement[]>;
  allShapesRefList: MutableRefObject<HTMLDivElement[]>;
  canvasRef: MutableRefObject<HTMLDivElement | null>;
  isHandToolActive: boolean;
  handleMouseDown: (event: React.MouseEvent) => void;
  handleMouseMove: (event: React.MouseEvent) => void;
  handleMouseUp: () => void;
  handleCanvasClick: (event: React.MouseEvent) => void;
  handleContextMenu: (event: React.MouseEvent<HTMLDivElement>) => void;
  isPrototypeReady: boolean;
  isAltKeyPressed: boolean;
  activeDragRef: MutableRefObject<ActiveDragState>;
}) {
  const ctx = useContext(ViewContext);
  if (!ctx) throw new Error("ZoomableComponent must be inside <ViewProvider>");

  let scale = useSyncExternalStore(
    ctx.subscribe,
    () => ctx.getSnapshot().scale
  );

  useEffect(() => {
    // setting the scale on component mount
    ctx.setScale(1);
  }, []);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const mouseUpStableRef = useRef(handleMouseUp);
  mouseUpStableRef.current = handleMouseUp;

  const { data: permanentPaths } = useQuery(getMultipagePathsQueryOptions());

  const { mutate: updateShapes } = useBatchUpdateShapesMutation();

  const { debugPath, setSelectedShapeIds, temporaryOffset } = useArtboardStore(
    useShallow((state) => ({
      debugPath: state.debugPath,
      setSelectedShapeIds: state.setSelectedShapeIds,
      temporaryOffset: state.temporaryOffset,
    }))
  );

  function handleMouseMoveGrid(e: React.MouseEvent<HTMLDivElement>) {
    if (!canvasRef.current || !ctx) return;
    const { left, top, width, height } =
      canvasRef.current.getBoundingClientRect();
    // Track the cursor position so we can center the radial gradient
    setMousePos({
      x: (e.clientX - left + width / 5) / scale,
      y: (e.clientY - top + height / 5) / scale,
    });
  }

  function getPermanentPath(path: PermanentPath) {
    if (!shapes) throw new Error("No shapes...");
    const shapeStart = shapes.find((shape) => shape.id === path.shapeStartId);
    const shapeEnd = shapes.find((shape) => shape.id === path.shapeEndId);
    if (!shapeStart || !shapeEnd) return null;

    const firstPoint = getMultipageHandlePoint({
      handle: path.shapeStartHandleType,
      ...shapeStart,
    });

    const lastPoint = getMultipageHandlePoint({
      handle: path.shapeEndHandleType,
      ...shapeEnd,
    });

    const pathWithExcludes = findOrthogonalPath(
      { x: firstPoint.xStart, y: firstPoint.yStart },
      { x: lastPoint.xStart, y: lastPoint.yStart },
      path.pageExcludeList
        .map((shapeId) =>
          shapes.find((shape) => shape.id.toString() === shapeId)
        )
        .filter((shapeOrUndefined) => shapeOrUndefined !== undefined),
      path.direction
    );
    if (pathWithExcludes.length === 0) {
      return findOrthogonalPath(
        { x: firstPoint.xStart, y: firstPoint.yStart },
        { x: lastPoint.xStart, y: lastPoint.yStart },
        [],
        path.direction
      );
    }
    return pathWithExcludes;
  }

  return (
    <div
      id="canvas"
      className={`w-[5000px] h-[5000px] absolute bg-[#2c2c2c] border-white border-[8px] rounded -top-[1000px] -left-[1000px] z-0 ${isHandToolActive ? "cursor-grab" : "arkhet-cursor"} ${!isPrototypeReady && "overflow-hidden"}`}
      onMouseDown={handleMouseDown}
      onMouseMove={(args) => {
        handleMouseMove(args);
        handleMouseMoveGrid(args);
      }}
      onMouseUp={handleCanvasClick}
      ref={canvasRef}
    >
      <div
        className={twMerge(
          `w-[5000px] h-[5000px] absolute bg-[#2c2c2c] border rounded -top-[1000px] -left-[1000px] z-0 transition-opacity duration-500`,
          ctx && scale >= 2 ? "opacity-1" : "opacity-0"
        )}
        style={{
          backgroundImage:
            "linear-gradient(to right, #444 1px, transparent 1px), linear-gradient(to bottom, #444 1px, transparent 1px)",
          backgroundSize: `${GRID_SIZE_PIXELS}px ${GRID_SIZE_PIXELS}px`,
        }}
      >
        <div
          className="top-0 left-0 w-[5000px] h-[5000px] pointer-events-none bg-[radial-gradient(circle_at_50%_50%,_transparent,_#2c2c2c)]"
          style={{
            background: `radial-gradient(
            circle at ${mousePos.x}px ${mousePos.y}px,
            rgba(44,44,44,0) 0%,
            rgba(44,44,44,0) 1%,
            rgba(44,44,44,0.8) 3%,
            rgba(44,44,44,1) 4%
          )`,
          }}
        />
      </div>
      <div className="relative w-full h-full not-shape">
        {debugPath && <GlobalPathSegments debugPath={debugPath.path} />}
        {permanentPaths &&
          shapes &&
          permanentPaths.map((path) => {
            const calculatedPath = getPermanentPath(path);
            if (!calculatedPath) return null;
            return (
              <GlobalPathSegments debugPath={calculatedPath} key={path.id} />
            );
          })}
        {canvasRef.current && (
          <div
            style={{
              left: `${mousePos.x - 1003}px`,
              top: `${mousePos.y - 1003}px`,
            }}
            className="mouse-follow absolute w-1 h-1 bg-transparent"
          />
        )}
        {shapes &&
          setupArtboardTree(shapes, updateShapes).map((shape) => (
            <div key={shape.id}>
              <MemoDragAndDrop
                temporaryOffset={
                  temporaryOffset &&
                  temporaryOffset.targetShapeIds.find((id) => id === shape.id)
                    ? { x: temporaryOffset.xOffset, y: temporaryOffset.yOffset }
                    : undefined
                }
                shapes={shapes}
                handleMouseUp={mouseUpStableRef.current}
                canvasRef={canvasRef}
                shape={shape}
                pageRefList={pageRefList}
                allShapesRefList={allShapesRefList}
                isHandToolActive={isHandToolActive}
                isAltKeyPressed={isAltKeyPressed}
                activeDragRef={activeDragRef}
                handleContextMenu={handleContextMenu}
                scale={scale}
              />
            </div>
          ))}
      </div>
    </div>
  );
}

export const MemoCanvas = memo(Canvas);
