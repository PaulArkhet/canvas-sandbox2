import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  memo,
  useSyncExternalStore,
} from "react";
import type { MutableRefObject, MouseEvent } from "react";
import useArtboardStore from "../store/ArtboardStore";
import type { Wireframe } from "../../../interfaces/artboard";
import debounce from "lodash/debounce";
import { getBoundsForShape, isShapeInPage } from "../routes/index";
import { ViewContext } from "./zoom/ViewContext";
import { DragHandles } from "./DragHandles";
import { GRID_SIZE_PIXELS } from "./Canvas";
import { MultipageHandles } from "./MultipageHandles";
import {
  useAltDragCopyMutation,
  useBatchUpdateShapesMutation,
  useShapeBatchOperations,
} from "../lib/api/shapes";
import type { IconType } from "react-icons";
import * as FaIcons from "react-icons/fa";
import * as BsIcons from "react-icons/bs";
import * as IoIcons from "react-icons/io";
import { v4 as uuid } from "uuid";
import { isShapeInsidePage } from "../utils/findOpenSpace";
import { useShallow } from "zustand/react/shallow";
import { RenderShape } from "./RenderShape";

export function getNearestGridCoordinate(currentPositionPixels: number) {
  return currentPositionPixels;
  // return (
  //   Math.round(currentPositionPixels / GRID_SIZE_PIXELS) * GRID_SIZE_PIXELS
  // );
}

export function findShape(shapeId: string, shapes: Wireframe[]) {
  return shapes.find((shapeItem) => shapeItem.id === shapeId);
}

type PageShape = Wireframe & { type: "page" };
type CardShape = Wireframe & { type: "card" };
type ChildShape = Wireframe & { pageId: string };

function isPage(shape: Wireframe): shape is PageShape {
  return shape.type === "page";
}

function isChildShape(shape: Wireframe): shape is ChildShape {
  return (
    shape &&
    typeof shape === "object" &&
    "pageId" in shape &&
    typeof shape.pageId === "string" &&
    shape.pageId.trim() !== "" &&
    !isPage(shape)
  );
}

export type DragPosition = { x: number; y: number };
export type DragDelta = { x: number; y: number };

type ButtonShape = Wireframe & {
  leadingIcon?: string;
  trailingIcon?: string;
  subtype?: "Small" | "Medium" | "Large";
};

export function DragAndDropComponent(props: {
  shape: ReturnType<typeof setupArtboardTree>[number];
  temporaryOffset?: { x: number; y: number };
  pageRefList?: MutableRefObject<HTMLDivElement[]>;
  canvasRef: MutableRefObject<HTMLDivElement | null>;
  allShapesRefList?: MutableRefObject<HTMLDivElement[]>;
  isHandToolActive: boolean;
  handleMouseUp: () => void;
  shapes: Wireframe[];
  leadingIcon?: IconType;
  trailingIcon?: IconType;
  isAltKeyPressed: boolean;
  isChild?: boolean;
  handleContextMenu: (event: React.MouseEvent<HTMLDivElement>) => void;
  scale: number;
}) {
  const DRAG_CANCEL_SELECTORS =
    ".input-blur,.text-input,.page-description,.no-drag";
  const { shape, isHandToolActive } = props;
  const [draggingEnabled, setDraggingEnabled] = useState(true);
  const [initialShapesBeforeEdit, setShapesBeforeChange] = useState<
    Wireframe[]
  >([]);

  const ctx = useContext(ViewContext)!; // we know it exists
  const scale = useSyncExternalStore(
    ctx.subscribe,
    () => ctx.getSnapshot().scale
  );
  const { updateShapes } = useShapeBatchOperations();
  const debouncedUpdateShape = debounce((updateProps) => {
    console.log(updateProps, "update props");
    updateShapes(updateProps);
  }, 300);
  const { mutate: handleAltDragFn } = useAltDragCopyMutation();
  const isCopyingRef = useRef(false);
  const [text, setText] = useState(shape.type === "text" ? shape.content : "");
  const [expectedPos, setExpectedPos] = useState<DragPosition | null>(null);
  const [optimisticPos, setOptimisticPos] = useState<DragPosition | null>(null);

  // once the backend/cache agrees with our optimistic numbers, clear them
  useEffect(() => {
    if (
      optimisticPos &&
      optimisticPos.x === shape.xOffset &&
      optimisticPos.y === shape.yOffset
    ) {
      setOptimisticPos(null);
    }
  }, [shape.xOffset, shape.yOffset, optimisticPos]);

  const [isDragging, setIsDragging] = useState(false);
  const [wasDragging, setWasDragging] = useState(false);
  const IconLibraries = { ...FaIcons, ...BsIcons, ...IoIcons };
  let LeadingIconComponent = null;
  let TrailingIconComponent = null;

  if (shape.type === "button") {
    const buttonShape = shape as ButtonShape;
    LeadingIconComponent = buttonShape.leadingIcon
      ? IconLibraries[buttonShape.leadingIcon as keyof typeof IconLibraries]
      : null;
    TrailingIconComponent = buttonShape.trailingIcon
      ? IconLibraries[buttonShape.trailingIcon as keyof typeof IconLibraries]
      : null;
  }

  function getNewPageId(
    shape: Wireframe,
    allPages: PageShape[]
  ): string | null {
    const centre = {
      x: shape.xOffset + shape.width / 2,
      y: shape.yOffset + shape.height / 2,
    };

    const host = allPages.find((p) => {
      const b = getBoundsForShape(p);
      return (
        centre.x > b.leftBound &&
        centre.x < b.rightBound &&
        centre.y > b.topBound &&
        centre.y < b.bottomBound
      );
    });

    return host ? host.id : null;
  }

  const iconSize = useMemo(() => {
    if (shape.type === "button") {
      const iconSizeMap = { Small: 12, Medium: 16, Large: 24 };
      const buttonShape = shape as ButtonShape;
      return buttonShape.subtype
        ? iconSizeMap[buttonShape.subtype] || 16
        : Math.max(12, Math.min(buttonShape.width, buttonShape.height) * 0.4);
    }
    return 16;
  }, [shape.width, shape.height, shape.type, (shape as ButtonShape).subtype]);

  if (shape.type === "button") {
    const buttonShape = shape as ButtonShape;
    LeadingIconComponent = buttonShape.leadingIcon
      ? IconLibraries[buttonShape.leadingIcon as keyof typeof IconLibraries]
      : null;
    TrailingIconComponent = buttonShape.trailingIcon
      ? IconLibraries[buttonShape.trailingIcon as keyof typeof IconLibraries]
      : null;
  }

  useEffect(() => {
    if (shape.type !== "text" || text === shape.content) return;

    const timeout = setTimeout(() => {
      updateShapes([
        { shapeId: shape.id, args: { type: shape.type, content: text } },
      ]);
    }, 300);

    return () => clearTimeout(timeout);
  }, [text]);
  const {
    setSelectedShapeIds,
    addUndoState,
    debugPath,
    selectedShapeIds,
    clearSelection,
  } = useArtboardStore(
    useShallow((state) => ({
      setSelectedShapeIds: state.setSelectedShapeIds,
      addUndoState: state.addUndoState,
      debugPath: state.debugPath,
      selectedShapeIds: state.selectedShapeIds,
      clearSelection: state.clearSelection,
    }))
  );
  const showMultiPageHandles =
    selectedShapeIds.size < 2 &&
    selectedShapeIds.has(shape.id) &&
    shape.type !== "page";
  const [isEditable, setIsEditable] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isPageHovered, setIsPageHovered] = useState(false);
  const { mutate: handleBatchUpdateShapes } = useBatchUpdateShapesMutation();
  const artboardTree = useMemo(() => {
    if (!props.shapes || props.shapes.length === 0) return [];
    return setupArtboardTree(props.shapes, handleBatchUpdateShapes);
  }, []);
  const determineSize = useCallback(() => {
    return {
      width: shape.width,
      height: shape.height,
    };
  }, [shape]);

  const determinePadding = useCallback(() => {
    switch (shape.type) {
      default:
        return "0px";
    }
  }, [shape]);

  function handleUpdateRefList(el: HTMLDivElement) {
    if (!el || !props.pageRefList) return;
    const { pageRefList, allShapesRefList } = props;
    const elId = shape.id.toString();
    const updateRefList = (refList: MutableRefObject<HTMLDivElement[]>) => {
      const currentList = refList.current || [];
      const index = currentList.findIndex((refEl) => refEl?.id === elId);

      let newList;
      if (index === -1) {
        newList = [...currentList, el];
      } else {
        newList = [...currentList];
        newList[index] = el;
      }

      refList.current = newList;
    };

    if (shape.type === "page") {
      pageRefList && updateRefList(pageRefList);
    }
    allShapesRefList && updateRefList(allShapesRefList);
  }

  const textUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const widthCheckTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (shape.type === "text" && "content" in shape && text !== shape.content) {
      setText(shape.content || "");
    }
  }, [shape.type === "text" && "content" in shape ? shape.content : undefined]);

  useEffect(() => {
    return () => {
      if (textUpdateTimeoutRef.current) {
        clearTimeout(textUpdateTimeoutRef.current);
      }
      if (widthCheckTimerRef.current) {
        clearTimeout(widthCheckTimerRef.current);
      }
    };
  }, []);

  function getPageChildren(pageId: string, shapes: Wireframe[]): ChildShape[] {
    if (!pageId || !shapes || !shapes.length) return [];

    return shapes.filter(
      (s): s is ChildShape => isChildShape(s) && s.pageId === pageId
    );
  }

  function handleAltDrag() {
    if (!props.isAltKeyPressed || !props.shapes || isCopyingRef.current) return;

    isCopyingRef.current = true;

    const selected = Array.from(selectedShapeIds)
      .map((id) => props.shapes.find((s) => s.id === id))
      .filter((s): s is Wireframe => !!s);

    let shapesToCopy: Wireframe[] = [];

    for (const shape of selected) {
      if (
        selected.some(
          (s) =>
            s.type === "page" &&
            s.id !== shape.id &&
            isShapeInsidePage(shape, s)
        )
      ) {
        continue;
      }

      if (shape.type === "page") {
        const newPageId = uuid();
        const newPage = {
          ...shape,
          id: newPageId,
          xOffset: shape.xOffset,
          yOffset: shape.yOffset,
        };

        const children = props.shapes.filter(
          (child) =>
            child.type !== "page" &&
            isShapeInsidePage(child, shape) &&
            !selected.some((s) => s.id === child.id)
        );

        const newChildren = children.map((child) => ({
          ...child,
          id: uuid(),
          xOffset: child.xOffset,
          yOffset: child.yOffset,
          pageId: newPageId,
        }));

        shapesToCopy.push(newPage, ...newChildren);
      } else {
        shapesToCopy.push({
          ...shape,
          id: uuid(),
          xOffset: shape.xOffset,
          yOffset: shape.yOffset,
        });
      }
    }

    handleAltDragFn({
      shapesToCopy,
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Small helpers                                                     */
  /* ------------------------------------------------------------------ */

  function globalXY(shape: Wireframe, pages: PageShape[]) {
    if (!("pageId" in shape) || !shape.pageId)
      return { x: shape.xOffset, y: shape.yOffset };

    const host = pages.find((p) => p.id === shape.pageId);
    if (!host) return { x: shape.xOffset, y: shape.yOffset };
    return { x: host.xOffset + shape.xOffset, y: host.yOffset + shape.yOffset };
  }

  // gets initialised in onDragStart; used by onDrag / onDragStop

  const parent = isChildShape(shape)
    ? props.shapes.find((s) => s.id === shape.pageId && s.type === "page")
    : null;

  const globalEqual = (exp: DragPosition | null) =>
    exp &&
    shape.xOffset === (parent ? exp.x + parent.xOffset : exp.x) &&
    shape.yOffset === (parent ? exp.y + parent.yOffset : exp.y);

  useEffect(() => {
    if (globalEqual(expectedPos)) setExpectedPos(null);
  }, [shape.xOffset, shape.yOffset, parent?.xOffset, parent?.yOffset]);

  const currentPos = expectedPos ?? { x: shape.xOffset, y: shape.yOffset };

  const renderPos = parent
    ? { x: currentPos.x - parent.xOffset, y: currentPos.y - parent.yOffset }
    : currentPos;

  function handleDragStart(e: RndDragEvent) {
    e.stopPropagation();
    e.preventDefault();
    setIsDragging(true);

    let currentSelection = new Set(selectedShapeIds);

    // if (
    //   !currentSelection.has(shape.id) &&
    //   !e.shiftKey &&
    //   !e.ctrlKey &&
    //   !e.metaKey
    // ) {
    //   currentSelection = new Set([shape.id]);
    //   setSelectedShapeIds(currentSelection);
    // } else if (!currentSelection.has(shape.id)) {
    //   currentSelection.add(shape.id);
    //   setSelectedShapeIds(currentSelection);
    // }

    if (e.altKey) {
      if (currentSelection.size > 1) {
        handleAltDrag();
      } else {
        const shapesToCopy = [];

        if (isPage(shape)) {
          const newPageId = uuid();
          const newPage = {
            ...shape,
            id: newPageId,
            xOffset: shape.xOffset,
            yOffset: shape.yOffset,
          };
          const children = props.shapes.filter(
            (child) =>
              child.type !== "page" &&
              "pageId" in child &&
              child.pageId === shape.id
          );

          const newChildren = children.map((child) => ({
            ...child,
            id: uuid(),
            xOffset: child.xOffset + 40,
            yOffset: child.yOffset + 40,
            pageId: newPageId,
          }));

          shapesToCopy.push(newPage, ...newChildren);
        } else {
          shapesToCopy.push({
            ...shape,
            id: uuid(),
            xOffset: shape.xOffset,
            yOffset: shape.yOffset,
          });
        }

        if (shapesToCopy.length > 0) {
          console.log("Copying shapes:", shapesToCopy.length);
          handleAltDragFn({
            shapesToCopy,
          });
        }
      }
    }
    // copy handled

    if (isPage(shape)) {
      const children = getPageChildren(shape.id, props.shapes);
      const currentMap = new Map<string, DragPosition>();

      [shape, ...children].forEach((child) => {
        currentMap.set(child.id, {
          x: child.xOffset,
          y: child.yOffset,
        });
      });
      }
    } else {
      if (currentSelection.has(shape.id)) {
        const selectedShapesMap = new Map<string, DragPosition>();

        currentSelection.forEach((id) => {
          const selectedShape = props.shapes.find((s) => s.id === id);
          if (selectedShape) {
            selectedShapesMap.set(id, {
              x: selectedShape.xOffset,
              y: selectedShape.yOffset,
            });
          }
        });

        if (props.activeDragRef) {
          props.activeDragRef.current = {
            pageId: null,
            primaryShapeId: shape.id,
            selectedShapeIds: Array.from(currentSelection),
            delta: { x: 0, y: 0 },
            isTransitioning: false,
            transitionPositions: new Map(),
          } as ActiveDragState;
        }
      }
    }
  }

  // function handleDrag(_: RndDragEvent, data: DraggableData) {
  //   /* accumulate global position (unchanged) */
  // }

  function handleDragStop(_: RndDragEvent, data: DraggableData) {
    const pages = props.shapes.filter(isPage);

    // const isMulti = selectedShapeIds.size > 1 && selectedShapeIds.has(shape.id);
    // /* ---------- MULTI-SELECTION ----------------------------------- */
    const parent = isChildShape(shape)
      ? pages.find((p) => p.id === shape.pageId)
      : null;

    const deltaX = data.x - shape.xOffset;
    const deltaY = data.y - shape.yOffset;

    const globalX = parent ? data.x + parent.xOffset : data.x;
    const globalY = parent ? data.y + parent.yOffset : data.y;

    // if (isMulti) {
    //   const updates = [...selectedShapeIds].map((id) => {
    //     const s = props.shapes.find((w) => w.id === id)!;
    //     const canvasX = getNearestGridCoordinate(s.xOffset + deltaX);
    //     const canvasY = getNearestGridCoordinate(s.yOffset + deltaY);

    //     const newPageId =
    //       s.type === "page"
    //         ? undefined
    //         : getNewPageId({ ...s, xOffset: canvasX, yOffset: canvasY }, pages);

    //     return {
    //       shapeId: s.id,
    //       args: {
    //         type: s.type,
    //         xOffset: canvasX,
    //         yOffset: canvasY,
    //         pageId: newPageId,
    //       },
    //     };
    //   });

    //   updates.forEach((u) => handleUpdateShape(u));

    //   props.activeDragRef.current = {
    //     pageId: null,
    //     primaryShapeId: undefined,
    //     selectedShapeIds: [],
    //     delta: { x: 0, y: 0 },
    //   };

    //   // setExpectedPos({
    //   //   x: globalX,
    //   //   y: globalY,
    //   // });
    //   setIsDragging(false);
    //   setWasDragging(false);
    //   return;
    // }

    const allUpdates = [];

    if (shape.type === "page") {
      // Get all children of the page
      const children = getPageChildren(shape.id, props.shapes);

      // Create a set of child IDs for faster lookups
      const childIds = new Set(children.map((child) => child.id));

      // Find shapes that should have their pageId set to null
      props.shapes.forEach((shapeItem) => {
        // shape has a pageId, is not in the child list, therefore should be marked as a non child
        if (
          "pageId" in shapeItem &&
          shapeItem.pageId === shape.id && // Only consider shapes that belong to this page
          !childIds.has(shapeItem.id)
        ) {
          allUpdates.push({
            shapeId: shapeItem.id,
            args: {
              type: shapeItem.type,
              pageId: null,
            },
          });
        }
      });

      // Calculate the updated page positions
      const pagesWithOffset = pages.map((page) => {
        if (page.shapeId !== shape.shapeId) return page;
        return {
          ...page,
          xOffset: getNearestGridCoordinate(globalX),
          yOffset: getNearestGridCoordinate(globalY),
        };
      });

      // Calculate updates for all children
      children.forEach((child) => {
        // calculate the new child position through their prev pos + delta
        const newPos = {
          xOffset: child.xOffset + deltaX,
          yOffset: child.yOffset + deltaY,
        };

        const newPageId = getNewPageId(
          {
            ...child,
            xOffset: newPos.xOffset,
            yOffset: newPos.yOffset,
          },
          pagesWithOffset
        );

        allUpdates.push({
          shapeId: child.id,
          args: {
            type: child.type,
            xOffset: newPos.xOffset,
            yOffset: newPos.yOffset,
            pageId: newPageId,
          },
        });
      });
    }

    // Add the update for the main shape
    allUpdates.push({
      shapeId: shape.id,
      args: {
        type: shape.type,
        xOffset: getNearestGridCoordinate(globalX),
        yOffset: getNearestGridCoordinate(globalY),
        pageId: parent
          ? parent.id
          : getNewPageId(
              {
                ...shape,
                xOffset: getNearestGridCoordinate(globalX),
                yOffset: getNearestGridCoordinate(globalY),
              },
              pages
            ),
      },
    });

    setExpectedPos({
      x: getNearestGridCoordinate(globalX),
      y: getNearestGridCoordinate(globalY),
    });

    // Send all updates in a single batch
    updateShapes(allUpdates, { isDragOperation: true });

    setIsDragging(false);
    setWasDragging(false);
  }

  return (
    <Rnd
      cancel={DRAG_CANCEL_SELECTORS}
      enableUserSelectHack={!isHandToolActive}
      enableResizing={!isHandToolActive && !shape.isInstanceChild}
      scale={scale}
      key={shape.id + shape.type}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        zIndex: shape.zIndex,
        position: "absolute",
        cursor: isHandToolActive ? "grab" : "arkhet-cursor",
        border:
          (selectedShapeIds.has(shape.id) && shape.type !== "page") ||
          (isHovered && shape.type !== "page") ||
          selectedShapeIds.has(shape.id)
            ? "2px solid #70acdc"
            : "2px solid transparent",
        padding: determinePadding(),
      }}
      resizeHandleComponent={{
        bottomRight: DragHandles({
          shape: props.shape,
          shouldDisplay:
            Array.from(selectedShapeIds).length === 1 &&
            selectedShapeIds.has(props.shape.id),
        })[0],
        bottomLeft: DragHandles({
          shape: props.shape,
          shouldDisplay:
            Array.from(selectedShapeIds).length === 1 &&
            selectedShapeIds.has(props.shape.id),
        })[1],
        topLeft: DragHandles({
          shape: props.shape,
          shouldDisplay:
            Array.from(selectedShapeIds).length === 1 &&
            selectedShapeIds.has(props.shape.id),
        })[2],
        topRight: DragHandles({
          shape: props.shape,
          shouldDisplay:
            Array.from(selectedShapeIds).length === 1 &&
            selectedShapeIds.has(props.shape.id),
        })[3],
      }}
      // onResizeStop={props.handleMouseUp}
      // maxWidth={shape.maxWidth} // this should be from the shapes properties, not here
      minWidth={shape.minWidth}
      default={{
        x: shape.xOffset,
        y: shape.yOffset,
        width: shape.width,
        height: shape.height,
      }}
      position={renderPos}
      size={determineSize()}
      disableDragging={!draggingEnabled || isHandToolActive}
      minHeight={shape.minHeight}
      bounds={props.canvasRef.current ? props.canvasRef.current : "parent"}
      onResizeStart={() => {
        setShapesBeforeChange(props.shapes);
      }}
      onDragStart={handleDragStart}
      // onDrag={handleDrag}
      onDragStop={handleDragStop}
      onResizeStop={(_, direction, ___, resizableDelta) => {
        addUndoState(initialShapesBeforeEdit);

        const offset = {
          x: 0,
          y: 0,
        };

        if (
          direction === "left" ||
          direction === "bottomLeft" ||
          direction === "topLeft"
        ) {
          offset.x += resizableDelta.width;
        }

        if (
          direction === "top" ||
          direction === "topRight" ||
          direction === "topLeft"
        ) {
          offset.y += resizableDelta.height;
        }

        updateShapes([
          {
            shapeId: shape.id,
            args: {
              type: shape.type,
              width: getNearestGridCoordinate(
                Math.max(shape.width + resizableDelta.width, 5)
              ),
              height: getNearestGridCoordinate(
                Math.max(shape.height + resizableDelta.height, 5)
              ),
              xOffset: getNearestGridCoordinate(shape.xOffset - offset.x),
              yOffset: getNearestGridCoordinate(shape.yOffset - offset.y),
            },
          },
        ]);
      }}
    >
      <div
        id={shape.id.toString()}
        className={`h-full relative shape`}
        ref={handleUpdateRefList}
        data-id={shape.id}
        data-description={shape.type === "page" ? shape.description : undefined}
        onClick={(e) => {
          if (isDragging || wasDragging) {
            return;
          }
          console.log(e.target);
          if (
            e.target instanceof Element &&
            (e.target.classList.contains("page-title") ||
              e.target.classList.contains("page-description"))
          ) {
            console.log("returning");
            return;
          }
          e.stopPropagation();

          let currentSelection = new Set(selectedShapeIds);

          if (e.shiftKey || e.ctrlKey || e.metaKey) {
            if (currentSelection.has(shape.id)) {
              currentSelection.delete(shape.id);
            } else {
              currentSelection.add(shape.id);
            }
            setSelectedShapeIds(currentSelection);
          } else {
            if (
              !(currentSelection.size === 1 && currentSelection.has(shape.id))
            ) {
              setSelectedShapeIds(new Set([shape.id]));
            }
          }
        }}
        onDoubleClick={(e) => {
          switch (shape.type) {
            case "button":
            case "text":
              break;
          }
        }}
      >
        {showMultiPageHandles && (
          <MultipageHandles
            setDraggingEnabled={setDraggingEnabled}
            canvasRef={props.canvasRef}
            shape={shape}
            isEditable={isEditable}
          />
        )}
        {shape.type === "page" &&
          debugPath &&
          findShape(debugPath.originalShapeId, props.shapes) &&
          !isShapeInPage(
            findShape(debugPath.originalShapeId, props.shapes)!,
            shape
          ) && (
            <MultipageHandles
              canvasRef={props.canvasRef}
              setDraggingEnabled={setDraggingEnabled}
              shape={shape}
              isEditable={isEditable}
            />
          )}
        <RenderShape
          shape={shape}
          isHandToolActive={isHandToolActive}
          isEditable={isEditable}
          setIsEditable={setIsEditable}
          isPageHovered={isPageHovered}
          setIsPageHovered={setIsPageHovered}
          setDraggingEnabled={setDraggingEnabled}
          selectedShapeIds={selectedShapeIds}
          setSelectedShapeIds={setSelectedShapeIds}
          clearSelection={clearSelection}
          scale={scale}
          debouncedUpdateShape={debouncedUpdateShape}
          LeadingIconComponent={LeadingIconComponent}
          TrailingIconComponent={TrailingIconComponent}
          iconSize={iconSize}
          text={text}
          setText={setText}
          textUpdateTimeoutRef={textUpdateTimeoutRef}
          canvasRef={props.canvasRef}
          handleContextMenu={props.handleContextMenu}
        />
        {"children" in shape &&
          (shape.children as Wireframe[]).map((child) => (
            <DragAndDropComponent
              {...props}
              shape={child}
              isChild
              key={child.id + "child-key"}
            />
          ))}
      </div>
    </Rnd>
  );
}
type UpdateShapeFn = ReturnType<typeof useBatchUpdateShapesMutation>["mutate"];

/**
 * Returns a fully-formed artboard tree.
 * If `handleUpdateShape` is provided, it persists any orphan-adoption fixes.
 */
export function setupArtboardTree(
  shapes: Wireframe[],
  handleUpdateShapeFn: UpdateShapeFn
) {
  if (!shapes?.length) return [];

  const pages = shapes.filter(isPage);
  const pageIds = new Set(pages.map((p) => p.id));

  /* ---------- bucket children ---------- */
  const pageMap = new Map<string, ChildShape[]>();
  shapes
    .filter((s): s is ChildShape => isChildShape(s))
    .forEach((s) => {
      pageMap.set(s.pageId, [...(pageMap.get(s.pageId) ?? []), s]);
    });

  /* ---------- adopt orphans ---------- */
  const finalOrphans: Wireframe[] = [];
  const batchUpdates: { shapeId: string; args: any }[] = [];

  shapes.forEach((s) => {
    if (s.type === "page") return;
    if ("pageId" in s && s.pageId && pageIds.has(s.pageId)) return; // already ok

    const host = pages.find((p) => isShapeInsidePage(s, p));
    if (host) {
      (s as ChildShape).pageId = host.id; // local fix
      pageMap.set(host.id, [...(pageMap.get(host.id) ?? []), s as ChildShape]);

      // Just collect the updates instead of sending them immediately
      batchUpdates.push({
        shapeId: s.id,
        args: { type: s.type, pageId: host.id },
      });
    } else {
      finalOrphans.push(s);
    }
  });

  // Send a single batch update after processing all shapes
  if (batchUpdates.length > 0) {
    console.log("Batch updating shapes:", batchUpdates.length);
    handleUpdateShapeFn(batchUpdates);
  }

  /* ---------- assemble ---------- */
  const trees = pages.map((p) => ({
    ...p,
    children: (pageMap.get(p.id) ?? []).map((c) => ({ ...c })),
  }));

  return [...trees, ...finalOrphans];
}

export const MemoDragAndDrop = memo(DragAndDropComponent, (prev, next) => {
  if (prev.scale !== next.scale) return false;
  if (
    (prev.activeDragRef.current.selectedShapeIds &&
      prev.activeDragRef.current.selectedShapeIds.includes(prev.shape.id)) ||
    (isChildShape(prev.shape) &&
      prev.shape.id === prev.activeDragRef.current.pageId)
  ) {
    console.log("returning this case");
    return false;
  }

  if (
    prev.shape === next.shape &&
    prev.isHandToolActive === next.isHandToolActive &&
    prev.isAltKeyPressed === next.isAltKeyPressed
  ) {
    return true;
  }
  return false;
});
