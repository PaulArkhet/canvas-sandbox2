import React, { useRef, useState, useEffect } from "react";

type Direction =
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export default function ResizeAndDrag({
  children,
  id,
  isSelected,
  onRefUpdate,
  x,
  y,
  setSelectedIds,
  width,
  height,
  onGroupDrag,
  position,
  onClick,
}: {
  children: React.ReactNode;
  id: string;
  isSelected?: boolean;
  onRefUpdate?: (id: string, ref: HTMLDivElement | null) => void;
  x: number;
  y: number;
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  width: number;
  height: number;
  onGroupDrag?: (id: string, deltaX: number, deltaY: number) => void;
  position?: { x: number; y: number };
  onClick?: (id: string, e: React.MouseEvent) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [positionState, setPosition] = useState({
    x: position?.x ?? x,
    y: position?.y ?? y,
  });
  const [size, setSize] = useState({ width: width, height: height });
  const isDragging = useRef(false);
  const resizeDir = useRef<Direction | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (position) {
      setPosition(position);
    }
  }, [position]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging.current) {
        const newX = e.clientX - dragOffset.current.x;
        const newY = e.clientY - dragOffset.current.y;

        // Calculate the delta from the last position
        const deltaX = newX - positionState.x;
        const deltaY = newY - positionState.y;

        // Call the group drag handler if component is selected
        if (isSelected && onGroupDrag) {
          onGroupDrag(id, deltaX, deltaY);
        } else {
          setPosition({ x: newX, y: newY });
        }
      } else if (resizeDir.current && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const dx = e.clientX - rect.left;
        const dy = e.clientY - rect.top;

        let newWidth = size.width;
        let newHeight = size.height;
        let newX = positionState.x;
        let newY = positionState.y;

        switch (resizeDir.current) {
          case "right":
            newWidth = dx;
            break;
          case "bottom":
            newHeight = dy;
            break;
          case "bottom-right":
            newWidth = dx;
            newHeight = dy;
            break;
          case "left":
            newWidth = size.width + (rect.left - e.clientX);
            newX = e.clientX;
            break;
          case "top":
            newHeight = size.height + (rect.top - e.clientY);
            newY = e.clientY;
            break;
          case "top-left":
            newWidth = size.width + (rect.left - e.clientX);
            newHeight = size.height + (rect.top - e.clientY);
            newX = e.clientX;
            newY = e.clientY;
            break;
          case "top-right":
            newWidth = dx;
            newHeight = size.height + (rect.top - e.clientY);
            newY = e.clientY;
            break;
          case "bottom-left":
            newWidth = size.width + (rect.left - e.clientX);
            newHeight = dy;
            newX = e.clientX;
            break;
        }

        if (newWidth > 50 && newHeight > 30) {
          setSize({ width: newWidth, height: newHeight });
          setPosition({ x: newX, y: newY });
        }
      }
    };

    function handleMouseUp() {
      isDragging.current = false;
      resizeDir.current = null;
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [size, positionState, isSelected, onGroupDrag, id]);

  function startDrag(e: React.MouseEvent) {
    e.stopPropagation();
    isDragging.current = true;
    dragOffset.current = {
      x: e.clientX - positionState.x,
      y: e.clientY - positionState.y,
    };
  }

  function startResize(dir: Direction) {
    return function (e: React.MouseEvent) {
      e.stopPropagation();
      resizeDir.current = dir;
    };
  }

  useEffect(() => {
    onRefUpdate?.(id, containerRef.current);
  }, [onRefUpdate, id]);

  return (
    <div
      ref={containerRef}
      className={`absolute ${isSelected && "border-[2px] border-[#70acdc]"} bg-transparent select-none hover:border-[2px] hover:border-[#70acdc]`}
      style={{
        left: positionState.x,
        top: positionState.y,
        width: size.width,
        height: size.height,
      }}
      onMouseDown={(e) => {
        startDrag(e);
        // Handle selection on mouse down instead
        if (onClick) {
          onClick(id, e);
        }
      }}
    >
      <div className="w-full h-full pointer-events-none">{children}</div>

      {/* Side handles (stretching full side) */}
      <div
        className="absolute top-0 left-0 w-full h-2 cursor-n-resize"
        onMouseDown={startResize("top")}
      />
      <div
        className="absolute bottom-0 left-0 w-full h-2 cursor-s-resize"
        onMouseDown={startResize("bottom")}
      />
      <div
        className="absolute top-0 left-0 h-full w-2 cursor-w-resize"
        onMouseDown={startResize("left")}
      />
      <div
        className="absolute top-0 right-0 h-full w-2 cursor-e-resize"
        onMouseDown={startResize("right")}
      />

      {/* Corner handles */}
      {isSelected && (
        <div
          className="absolute top-[-6px] left-[-6px] w-2 h-2 border border-[#70acdc] bg-[#2c2c2c] cursor-nw-resize"
          onMouseDown={startResize("top-left")}
        />
      )}
      {isSelected && (
        <div
          className="absolute top-[-6px] right-[-6px] w-2 h-2 border border-[#70acdc] bg-[#2c2c2c] cursor-ne-resize"
          onMouseDown={startResize("top-right")}
        />
      )}
      {isSelected && (
        <div
          className="absolute bottom-[-6px] left-[-6px] w-2 h-2 border border-[#70acdc] bg-[#2c2c2c] cursor-sw-resize"
          onMouseDown={startResize("bottom-left")}
        />
      )}
      {isSelected && (
        <div
          className="absolute bottom-[-6px] right-[-6px] w-2 h-2 border border-[#70acdc] bg-[#2c2c2c] cursor-se-resize"
          onMouseDown={startResize("bottom-right")}
        />
      )}
    </div>
  );
}
