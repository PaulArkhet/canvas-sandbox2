import React, { useRef, useState, useEffect } from "react";

type Props = {
  children: React.ReactNode;
};

type Direction =
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export default function ResizeAndDrag({ children }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [size, setSize] = useState({ width: 200, height: 100 });

  const isDragging = useRef(false);
  const resizeDir = useRef<Direction | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging.current) {
        setPosition({
          x: e.clientX - dragOffset.current.x,
          y: e.clientY - dragOffset.current.y,
        });
      } else if (resizeDir.current && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const dx = e.clientX - rect.left;
        const dy = e.clientY - rect.top;

        let newWidth = size.width;
        let newHeight = size.height;
        let newX = position.x;
        let newY = position.y;

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

    const handleMouseUp = () => {
      isDragging.current = false;
      resizeDir.current = null;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [size, position]);

  const startDrag = (e: React.MouseEvent) => {
    e.stopPropagation();
    isDragging.current = true;
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  };

  const startResize = (dir: Direction) => (e: React.MouseEvent) => {
    e.stopPropagation();
    resizeDir.current = dir;
  };

  return (
    <div
      ref={containerRef}
      className="absolute border border-blue-500 bg-white select-none"
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
      }}
      onMouseDown={startDrag}
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
      <div
        className="absolute top-0 left-0 w-3 h-3 bg-blue-500 cursor-nw-resize"
        onMouseDown={startResize("top-left")}
      />
      <div
        className="absolute top-0 right-0 w-3 h-3 bg-blue-500 cursor-ne-resize"
        onMouseDown={startResize("top-right")}
      />
      <div
        className="absolute bottom-0 left-0 w-3 h-3 bg-blue-500 cursor-sw-resize"
        onMouseDown={startResize("bottom-left")}
      />
      <div
        className="absolute bottom-0 right-0 w-3 h-3 bg-blue-500 cursor-se-resize"
        onMouseDown={startResize("bottom-right")}
      />
    </div>
  );
}
