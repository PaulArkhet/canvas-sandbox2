import useArtboardStore from "../store/ArtboardStore";
import type { TemporaryPath } from "../store/ArtboardStore";
import type { Wireframe } from "../../../interfaces/artboard";
import type { HandleType } from "../../../interfaces/artboard";
import {
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import type { MutableRefObject } from "react";
import { twMerge } from "tailwind-merge";
import { findOrthogonalPath } from "../lib/orthogonal-finder";
import { getBoundsForShape, isInBoundsOfOuterShape } from "../routes/index";
import { match } from "ts-pattern";
import {
  getMultipagePathsQueryOptions,
  useCreateMultipagePathMutation,
  useDeleteMultipagePathMutation,
} from "../lib/api/multipage-paths";
import { useQuery } from "@tanstack/react-query";
import { getAllShapesQueryOptions } from "../lib/api/shapes";
import { ViewContext } from "./zoom/ViewContext";
import { useShallow } from "zustand/react/shallow";
export function getMultipageHandlePoint(args: {
  handle: HandleType;
  xOffset: number;
  yOffset: number;
  width: number;
  height: number;
}) {
  return match(args.handle)
    .with("top", () => ({
      xStart: args.xOffset + args.width / 2,
      yStart: args.yOffset - 20,
    }))
    .with("left", () => ({
      xStart: args.xOffset - 12,
      yStart: args.yOffset + args.height / 2 - 3,
    }))
    .with("bottom", () => ({
      xStart: args.xOffset + args.width / 2,
      yStart: args.yOffset + args.height + 12,
    }))
    .with("right", () => ({
      xStart: args.xOffset + args.width + 14,
      yStart: args.yOffset + args.height / 2 - 3,
    }))
    .exhaustive();
}

function pathsEqual(
  a: { x: number; y: number }[],
  b: { x: number; y: number }[]
) {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].x !== b[i].x || a[i].y !== b[i].y) return false;
  }
  return true;
}

export function MultipageHandles(props: {
  setDraggingEnabled: (enabled: boolean) => void;
  shape: Wireframe;
  isEditable?: boolean;
  canvasRef: MutableRefObject<HTMLDivElement | null>;
}) {
  const { data: shapes } = useQuery(getAllShapesQueryOptions());
  if (!shapes) return null;

  const [mousePos, setMousePos] = useState({
    x: 0,
    y: 0,
  });
  const [isDraggingHandle, setIsDraggingHandle] = useState(false);

  function updateMousePos(clientX: number, clientY: number) {
    if (!props.canvasRef.current) return;
    const { left, top, width, height } =
      props.canvasRef.current.getBoundingClientRect();
    setMousePos({
      x: (clientX - left + width / 5) / scale,
      y: (clientY - top + height / 5) / scale,
    });
  }

  function handleMouseDown(
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    type: HandleType
  ) {
    e.stopPropagation();
    e.preventDefault();
    handleClick(e, type);

    // begin drag
    setIsDraggingHandle(true);
    props.setDraggingEnabled(false);
    updateMousePos(e.clientX, e.clientY);
  }

  const ctx = useContext(ViewContext);

  // call the hook unconditionally, even when ctx is undefined
  const scale = useSyncExternalStore(
    ctx?.subscribe ?? (() => () => {}), // no‑op subscribe
    () => ctx?.getSnapshot().scale ?? 1 // safe default snapshot
  );

  // now handle the error/fallback in the render phase
  if (!ctx) {
    console.error("ViewContext provider missing");
    return null; // still renders the same number of hooks
  }

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!isDraggingHandle) return; // only needed while dragging
    e.stopPropagation();
    updateMousePos(e.clientX, e.clientY);
  }

  const { debugPath, setIsHandToolActive, setDebugPath } = useArtboardStore(
    useShallow((state) => ({
      debugPath: state.debugPath,
      setIsHandToolActive: state.setIsHandToolActive,
      setDebugPath: state.setDebugPath,
    }))
  );

  const [selectedHandle, setSelectedHandle] = useState<HandleType | "none">(
    "none"
  );

  const { data: permanentPaths } = useQuery(getMultipagePathsQueryOptions());
  const { mutate: createPermanentPath } = useCreateMultipagePathMutation();
  const { mutate: deletePermanentPath } = useDeleteMultipagePathMutation();

  // For updating a checkbox when the [+] button is clicked
  const [isAddCheckboxOptionHover, setIsAddCheckboxOptionHover] =
    useState(false);

  useEffect(() => {
    if (!isDraggingHandle) return;

    function handleMove(ev: MouseEvent) {
      updateMousePos(ev.clientX, ev.clientY);
    }

    function handleUp() {
      setIsDraggingHandle(false);
      props.setDraggingEnabled(true);

      setSelectedHandle("none");
      setDebugPath(null);
    }

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [isDraggingHandle, scale]);

  const pages = useMemo(
    () => shapes.filter((shape) => shape.type === "page"),
    [shapes]
  );

  function escapeSelection(e: KeyboardEvent) {
    if (e.key !== "Escape") return;
    setSelectedHandle((prevHandle) =>
      prevHandle !== "none" ? "none" : prevHandle
    );
    setDebugPath(null);
  }

  useEffect(() => {
    window.addEventListener("keydown", escapeSelection);
    return () => window.removeEventListener("keydown", escapeSelection);
  }, []);

  function handleMouseEnter() {
    props.setDraggingEnabled(false);
  }

  function handleMouseLeave() {
    props.setDraggingEnabled(true);
  }

  function handleSetupPermanentPath(debugPath: TemporaryPath) {
    if (debugPath.path.length === 0) return;

    const lastPoint = debugPath.path.at(-1)!;
    // we wanna check all of our possible points
    //
    const allPoints = (["top", "left", "right", "bottom"] as const).map(
      (handle) => ({
        ...getMultipageHandlePoint({ handle, ...props.shape }),
        handleType: handle,
      })
    );

    const closestPoint = allPoints.reduce(
      (acc, current) => {
        const deltaXCurrent = lastPoint.x - current.xStart;
        const deltaYCurrent = lastPoint.y - current.yStart;
        const sumSquaresCurrent =
          Math.sqrt(Math.pow(deltaXCurrent, 2)) +
          Math.sqrt(Math.pow(deltaYCurrent, 2));

        const deltaXAcc = lastPoint.x - acc.xStart;
        const deltaYAcc = lastPoint.y - acc.yStart;
        const sumSquaresAcc =
          Math.sqrt(Math.pow(deltaXAcc, 2)) + Math.sqrt(Math.pow(deltaYAcc, 2));

        return sumSquaresCurrent < sumSquaresAcc ? current : acc;
      },
      { xStart: Infinity, yStart: Infinity, handleType: "top" }
    );

    const newPath = {
      shapeStartId: debugPath.originalShapeId,
      shapeStartHandleType: debugPath.handleType,
      shapeEndId: props.shape.id,
      shapeEndHandleType: closestPoint.handleType,
      ...debugPath,
      pageExcludeList: debugPath.pageExcludeList.map((number) =>
        number.toString()
      ),
    };
    props.setDraggingEnabled(true);
    createPermanentPath(newPath, {
      onSettled: () => {
        console.log("setting this to null!");
        setDebugPath(null);
        setSelectedHandle("none");
      },
    });
    return;
  }

  function handleClick(
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    type: HandleType
  ) {
    e.stopPropagation();
    if (!permanentPaths) {
      return setTimeout(() => handleClick, 1000);
    }
    if (props.shape.type === "page" && debugPath) {
      // we also wanna check if a path already exists; we wish to overwrite that path with this one

      const foundPathsFromOriginalShape = permanentPaths.filter(
        (path) => path.shapeStartId === debugPath.originalShapeId
      );
      // if we find one, delete the old path and proceed as normal
      if (foundPathsFromOriginalShape.length !== 0) {
        foundPathsFromOriginalShape.map((path) => {
          deletePermanentPath({
            multipageId: path.id,
          });
        });
      }
      handleSetupPermanentPath(debugPath);
      return;
    }

    setSelectedHandle(type);
    setIsHandToolActive(false);
    setDebugPath(null);
  }

  useEffect(() => {
    if (!isDraggingHandle || selectedHandle === "none") return;

    const { xOffset, yOffset, width, height } = props.shape;
    const mouseX = mousePos.x - 1000;
    const mouseY = mousePos.y - 1000;

    let autoHandle: "left" | "right" | "top" | "bottom" = selectedHandle;
    const left = xOffset;
    const right = xOffset + width;
    const top = yOffset;
    const bottom = yOffset + height;

    if (mouseX < left) autoHandle = "left";
    else if (mouseX > right) autoHandle = "right";
    else if (mouseY < top) autoHandle = "top";
    else if (mouseY > bottom) autoHandle = "bottom";
    else {
      const d = [mouseX - left, right - mouseX, mouseY - top, bottom - mouseY];
      autoHandle = ["left", "right", "top", "bottom"][
        d.indexOf(Math.min(...d))
      ] as typeof autoHandle;
    }

    if (autoHandle !== selectedHandle) setSelectedHandle(autoHandle);

    const { xStart, yStart } = getMultipageHandlePoint({
      handle: autoHandle,
      xOffset,
      yOffset,
      width,
      height,
    });

    const p1 = { x: xStart, y: yStart };
    const p2 = { x: mouseX, y: mouseY };
    const direction =
      autoHandle === "left" || autoHandle === "right"
        ? "vertical"
        : "horizontal";

    const validPages = pages.filter((page) => {
      const pageB = getBoundsForShape(page);
      const shapeB = getBoundsForShape(props.shape);
      return !isInBoundsOfOuterShape(pageB, shapeB);
    });

    const pageExclude = [...validPages, props.shape];
    let path = findOrthogonalPath(p1, p2, pageExclude, direction);
    if (path.length === 0) path = findOrthogonalPath(p1, p2, [], direction);

    const nextDebug: TemporaryPath = {
      path,
      originalShapeId: props.shape.id,
      direction,
      handleType: autoHandle,
      pageExcludeList: path.length ? pageExclude.map((p) => p.id) : [],
    };

    if (
      !debugPath ||
      debugPath.originalShapeId !== nextDebug.originalShapeId ||
      debugPath.handleType !== nextDebug.handleType ||
      !pathsEqual(debugPath.path, nextDebug.path)
    ) {
      setDebugPath(nextDebug);
    }
  }, [mousePos, selectedHandle, props.shape, pages]);

  /*
   * Need to create a series of divs to model the arrow
   * we can have:
   * vertical line,
   * horizontal line,
   * curved segments; we can think of these as a square of x,y width and height
   * we place these at the intersections of lines
   * we also would like to avoid any pages when placing lines
   * */

  return (
    // Ensures that the handles are not clickable when the shape is in it's editing mode
    <div
      className={`${props.isEditable ? "pointer-events-none" : ""}`}
      onMouseMove={(args) => {
        handleMouseMove(args);
      }}
    >
      {/* top */}
      <div className="absolute w-full top-0 left-0 flex flex-row justify-center">
        <div
          className={twMerge(
            `relative bottom-5  w-[11px] h-[11px] border-white bg-[#42A5F5] rounded-full border hover:cursor-pointer hover:border-[#42A5F5] multipage-handle top z-20 transition-colors`,
            selectedHandle === "top" ? "bg-[#42A5F5]" : ""
          )}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onMouseUp={(e) => {
            handleClick(e, "top");
          }}
          onMouseDown={(e) => {
            handleMouseDown(e, "top");
          }}
        ></div>
      </div>
      {/* left */}
      <div className="absolute h-full top-0 left-0 flex flex-col justify-center">
        <div
          className={twMerge(
            `relative right-5  w-[11px] h-[11px] border-white bg-[#42A5F5] rounded-full border hover:cursor-pointer hover:border-[#42A5F5] multipage-handle transition-colors`,
            selectedHandle === "left" ? "bg-[#42A5F5]" : ""
          )}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onMouseUp={(e) => {
            handleClick(e, "left");
          }}
          onMouseDown={(e) => handleMouseDown(e, "left")}
        />
      </div>
      {/* right */}
      <div className="absolute h-full bottom-0 right-0 flex flex-col justify-center">
        <div
          className={twMerge(
            `relative left-5 w-[11px] h-[11px] border-white bg-[#42A5F5] rounded-full border hover:cursor-pointer hover:border-[#42A5F5] multipage-handle transition-colors`,
            selectedHandle === "right" ? "bg-[#42A5F5]" : ""
          )}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onMouseUp={(e) => {
            handleClick(e, "right");
          }}
          onMouseDown={(e) => handleMouseDown(e, "right")}
        />
      </div>
      {/* bottom */}
      <div className="absolute w-full bottom-0 left-0 flex flex-row justify-center">
        <div
          className={twMerge(
            `relative top-5  w-[11px] h-[11px] border-white bg-[#42A5F5] rounded-full border hover:cursor-pointer hover:border-[#42A5F5] multipage-handle transition-colors`,
            selectedHandle === "bottom" ? "bg-[#42A5F5]" : ""
          )}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onMouseUp={(e) => handleClick(e, "bottom")}
          onMouseDown={(e) => handleMouseDown(e, "bottom")}
        />
      </div>
    </div>
  );
}
