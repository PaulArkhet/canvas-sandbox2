import type { Wireframe } from "../../../interfaces/artboard";
import type { IconType } from "react-icons";
import { getNearestGridCoordinate } from "./DragAndDropComponent";
import { useShapeBatchOperations } from "../lib/api/shapes";
import React, { useEffect, useRef } from "react";

/* ------------------------------------------------------------------ */
/*  Public props                                                      */
/* ------------------------------------------------------------------ */

export interface RenderShapeProps {
  /* model */
  shape: Wireframe;

  /* editing state */
  isHandToolActive: boolean;
  isEditable: boolean;
  setIsEditable: (v: boolean) => void;

  /* hover state (for pages) */
  isPageHovered: boolean;
  setIsPageHovered: (v: boolean) => void;

  /* selection */
  selectedShapeIds: Set<string>;
  setSelectedShapeIds: (ids: Set<string>) => void;
  clearSelection: () => void;

  /* drag helpers */
  setDraggingEnabled: (b: boolean) => void;

  /* live scale (for opacity on page zoom) */
  scale: number;

  /* debounce + server updates */
  debouncedUpdateShape: (opts: {
    shapeId: string;
    args: Record<string, unknown>;
  }) => void;

  /* misc helpers from the parent component ------------------------- */
  //
  //
  //
  LeadingIconComponent?: IconType | null;
  TrailingIconComponent?: IconType | null;
  iconSize?: number;

  /* text state for <textarea> */
  text: string;
  setText: (t: string) => void;
  textUpdateTimeoutRef?: React.MutableRefObject<NodeJS.Timeout | null>;

  /* canvas ref (needed for auto‑width text) */
  canvasRef?: React.MutableRefObject<HTMLDivElement | null>;

  /* optional children for rendering in screenshotting libraries */
  children?: React.JSX.Element[];

  /* handling context menu for moving layers */
  handleContextMenu: (event: React.MouseEvent<HTMLDivElement>) => void;
}

/* ------------------------------------------------------------------ */
/*  Implementation                                                    */
/* ------------------------------------------------------------------ */

export function RenderShape(props: RenderShapeProps) {
  const {
    shape,

    /* flags / setters */
    isHandToolActive,
    isEditable,
    setIsEditable,
    isPageHovered,
    setIsPageHovered,
    setDraggingEnabled,

    /* selection */
    selectedShapeIds,
    setSelectedShapeIds,
    clearSelection,

    /* other helpers */
    scale,
    debouncedUpdateShape,
    LeadingIconComponent,
    TrailingIconComponent,
    iconSize = 16,

    /* text editing */
    text,
    setText,
    textUpdateTimeoutRef,
    canvasRef,

    /* handling context menu */
    handleContextMenu,
  } = props;

  /* ---------------------------------------------------------------- */
  /*  Render helpers                                                  */
  /* ---------------------------------------------------------------- */
  const pageSelected = selectedShapeIds.has(shape.id);
  const pageHoverCls = isPageHovered ? "text-sky-200" : "";
  const cursorCls = isHandToolActive ? "cursor-grab" : "arkhet-cursor";

  /* ---------------------------------------------------------------- */
  /*  Query                                           */
  /* ---------------------------------------------------------------- */
  const { updateShapes } = useShapeBatchOperations();

  /* ---------------------------------------------------------------- */
  /*  Refs                                           */
  /* ---------------------------------------------------------------- */

  const inputRef = useRef<HTMLInputElement | null>(null);
  const textRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsEditable(false);
        inputRef.current?.blur();
        textRef.current?.blur();
        setDraggingEnabled(true);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    function blurInput(e: MouseEvent) {
      if (
        e.target instanceof HTMLInputElement &&
        e.target.classList.contains("input-blur")
      ) {
        return;
      }

      if (
        e.target instanceof HTMLTextAreaElement &&
        e.target.classList.contains("text-input")
      ) {
        return;
      }

      inputRef.current?.blur();
      textRef.current?.blur();
      setIsEditable(false);
    }

    window.addEventListener("mousedown", blurInput);
    () => {
      window.removeEventListener("mousedown", blurInput);
    };
  }, []);

  /** ---------- PAGE ------------------------------------------------ */
  if (shape.type === "page") {
    return (
      <>
        <div
          className={`pb-5 absolute w-full -top-8 left-2 ${pageHoverCls} ${cursorCls}`}
          onMouseEnter={() => setIsPageHovered(true)}
          onMouseLeave={() => setIsPageHovered(false)}
          onMouseDown={() => clearSelection()}
        >
          {!isEditable ? (
            <div
              onFocus={() => setDraggingEnabled(false)}
              onBlur={() => {
                setDraggingEnabled(true);
                setIsEditable(false);
              }}
              onDoubleClick={() => {
                setIsEditable(true);
              }}
            >
              {shape.title}
            </div>
          ) : (
            <input
              ref={(r) => r && r.focus()}
              onDoubleClick={() => {
                setIsEditable(false);
              }}
              className="bg-transparent focus:outline-none arkhet-cursor page-title input-blur"
              defaultValue={shape.title}
              onChange={(e) => {
                console.log("updating with args:", {
                  shapeId: shape.id,
                  args: { type: shape.type, title: e.target.value },
                });
                debouncedUpdateShape({
                  shapeId: shape.id,
                  args: { type: shape.type, title: e.target.value },
                });
              }}
              type="text"
            />
          )}
        </div>

        {/* inner page rectangle */}
        <div
          className={`page page-inner w-full h-full bg-[#262626] bg-opacity-75 rounded-2xl transition-opacity duration-500 ${
            isPageHovered ? "page-focus border border-[#70acdc]" : ""
          } ${scale >= 2 ? "opacity-50" : "bg-opacity-100"} ${cursorCls}`}
          onMouseEnter={() => setDraggingEnabled(false)}
          onMouseLeave={() => setDraggingEnabled(true)}
          onClick={() => setIsEditable(false)}
        >
          {props.children && props.children}
        </div>

        {/* description under the page */}
        <input
          ref={inputRef}
          onDoubleClick={(e) => {
            e.currentTarget.focus();
          }}
          className={`bg-transparent focus:outline-none w-full my-2 input-blur ${
            pageSelected ? "text-sky-200" : ""
          }`}
          defaultValue={shape.description}
          onChange={(e) =>
            debouncedUpdateShape({
              shapeId: shape.id,
              args: { type: shape.type, description: e.target.value },
            })
          }
          type="text"
        />
      </>
    );
  }

  /** ---------- BUTTON --------------------------------------------- */
  if (shape.type === "button") {
    const { fontWeight, fontStyle, textDecoration, textAlign, title, subtype } =
      shape as Extract<Wireframe, { type: "button" }>;

    return (
      <div
        className={`relative w-full h-full flex items-center flex-col text-left rounded justify-center ${subtype} [container-type:size] ${cursorCls}`}
        onDoubleClick={() => {
          setIsEditable(true);
          setSelectedShapeIds(new Set([shape.id]));
        }}
        onContextMenu={(e) => {
          handleContextMenu(e);
          setSelectedShapeIds(new Set([shape.id]));
        }}
      >
        {isEditable ? (
          <input
            autoFocus
            className="text-[50cqh] text-center w-[90%] bg-transparent input-blur"
            ref={inputRef}
            defaultValue={title}
            onChange={(e) => {
              console.log("debounce updating with:", {
                type: shape.type,
                title: e.target.value,
              });
              debouncedUpdateShape({
                shapeId: shape.id,
                args: { type: shape.type, title: e.target.value },
              });
            }}
            onBlur={() => setIsEditable(false)}
          />
        ) : (
          <div
            className={`w-full h-full flex items-center gap-2 ${cursorCls}`}
            style={{
              fontWeight,
              fontStyle,
              textDecoration,
              justifyContent:
                textAlign === "left"
                  ? "flex-start"
                  : textAlign === "right"
                    ? "flex-end"
                    : "center",
              padding: "0 12px",
            }}
          >
            {textAlign === "center" && LeadingIconComponent && (
              <LeadingIconComponent size={iconSize} />
            )}
            <span className="truncate">{title}</span>
            {textAlign === "center" && TrailingIconComponent && (
              <TrailingIconComponent size={iconSize} />
            )}
          </div>
        )}
      </div>
    );
  }

  /** ---------- TEXT ------------------------------------------------ */
  if (shape.type === "text") {
    const s = shape as Extract<Wireframe, { type: "text" }>;

    return (
      <div
        className={`w-full h-full ${cursorCls}`}
        onDoubleClick={(e) => {
          e.stopPropagation();
          setIsEditable(true);
          setSelectedShapeIds(new Set([shape.id]));
        }}
        onContextMenu={(e) => {
          handleContextMenu(e);
          setSelectedShapeIds(new Set([shape.id]));
        }}
      >
        {isEditable ? (
          <textarea
            ref={(r) => {
              r && r.focus();
              textRef.current = r;
            }}
            value={text}
            autoFocus
            className={`bg-transparent focus:outline-none text-input ${s.fontColor} ${s.fontSize} 
              ${s.isBold ? "font-bold" : ""} 
              ${s.isItalic ? "italic" : ""} 
              ${s.isUnderlined ? "underline" : ""} 
              ${s.isStrikethrough ? "line-through" : ""} 
              ${s.alignment === "center" ? "text-center" : ""} 
              ${s.alignment === "right" ? "text-right" : ""}
              ${s.widthMode === "auto-width" ? "w-auto min-w-full" : "w-full"} h-full`}
            style={
              s.widthMode === "auto-width"
                ? {
                    width: "fit-content",
                    display: "inline-block",
                    whiteSpace: "nowrap",
                    resize: "none",
                  }
                : { resize: "none", overflow: "auto" }
            }
            onChange={(e) => {
              setText(e.target.value);

              if (textUpdateTimeoutRef && textUpdateTimeoutRef.current)
                clearTimeout(textUpdateTimeoutRef.current);

              if (textUpdateTimeoutRef && textUpdateTimeoutRef.current) {
                textUpdateTimeoutRef.current = setTimeout(() => {
                  debouncedUpdateShape({
                    shapeId: shape.id,
                    args: { type: "text", content: e.target.value },
                  });

                  /* auto‑width adjustment (unchanged) */
                  if (
                    s.widthMode === "auto-width" &&
                    canvasRef &&
                    canvasRef.current
                  ) {
                    const meas = document.createElement("div");
                    meas.style.position = "absolute";
                    meas.style.visibility = "hidden";
                    meas.style.whiteSpace = "nowrap";
                    meas.style.display = "inline-block";
                    meas.className = `${s.fontColor} ${s.fontSize}`;
                    meas.textContent = e.target.value;
                    canvasRef.current.appendChild(meas);
                    const newW = meas.offsetWidth + 20;
                    canvasRef.current.removeChild(meas);

                    if (Math.abs(newW - s.width) > 10) {
                      debouncedUpdateShape({
                        shapeId: shape.id,
                        args: {
                          type: "text",
                          width: getNearestGridCoordinate(Math.max(newW, 40)),
                        },
                      });
                    }
                  }
                }, 10) as unknown as NodeJS.Timeout;
              }
            }}
            onBlur={() => setIsEditable(false)}
          />
        ) : (
          <div
            className={`bg-transparent select-none ${s.fontColor} ${s.fontSize} 
              ${s.isBold ? "font-bold" : ""} 
              ${s.isItalic ? "italic" : ""} 
              ${s.isUnderlined ? "underline" : ""} 
              ${s.isStrikethrough ? "line-through" : ""} 
              ${s.alignment === "center" ? "text-center" : ""} 
              ${s.alignment === "right" ? "text-right" : ""}
              ${s.widthMode === "auto-width" ? "w-auto" : "w-full"} h-full`}
            style={
              s.widthMode === "auto-width"
                ? { display: "inline-block", whiteSpace: "nowrap" }
                : { whiteSpace: "normal", overflow: "hidden" }
            }
          >
            {s.content}
          </div>
        )}
      </div>
    );
  }

  return <div>ERR: Unsupported shape</div>;
}
