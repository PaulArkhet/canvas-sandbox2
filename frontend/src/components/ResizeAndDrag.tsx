import React, {
  useRef,
  useState,
  useEffect,
  type SetStateAction,
  type Dispatch,
} from "react";

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
  width,
  height,
  selectedIds,
  setSelectedIds,
  onDragStart,
  onDrag,
  onDragEnd,
}: {
  children: React.ReactNode;
  id: string;
  isSelected?: boolean;
  onRefUpdate?: (id: string, ref: HTMLDivElement | null) => void;
  x: number;
  y: number;
  width: number;
  height: number;
  selectedIds: string[];
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  onDragStart?: (id: string, x: number, y: number) => void;
  onDrag?: (id: string, dx: number, dy: number) => void;
  onDragEnd?: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: x, y: y });
  const [size, setSize] = useState({ width: width, height: height });
  const isDragging = useRef(false);
  const resizeDir = useRef<Direction | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const lastPosition = useRef({ x, y });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging.current) {
        const newX = e.clientX - dragOffset.current.x;
        const newY = e.clientY - dragOffset.current.y;

        // Calculate delta from the start of the drag operation
        const dx = newX - lastPosition.current.x;
        const dy = newY - lastPosition.current.y;

        setPosition({ x: newX, y: newY });

        // Inform parent about the drag movement
        if (onDrag) {
          onDrag(id, dx, dy);
        }
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

    function handleMouseUp() {
      if (isDragging.current && onDragEnd) {
        onDragEnd(id);
      }
      isDragging.current = false;
      resizeDir.current = null;
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [size, position, id, onDrag, onDragEnd]);

  // Sync actual position from props whenever not dragging
  useEffect(() => {
    // Only update if not currently being dragged to avoid jumps
    if (!isDragging.current) {
      setPosition({ x, y });
      // Also update the lastPosition ref to ensure deltas are calculated correctly
      lastPosition.current = { x, y };
    }
  }, [x, y]);

  function startDrag(e: React.MouseEvent) {
    e.stopPropagation();

    // If not selected, make this the only selected item (unless using modifier)
    if (!isSelected) {
      const ctrlKey = e.ctrlKey || e.metaKey;
      if (ctrlKey) {
        setSelectedIds((prev) => [...prev, id]);
      } else {
        setSelectedIds([id]);
      }
    }

    // Start drag after any selection is complete
    isDragging.current = true;
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
    lastPosition.current = { ...position };

    if (onDragStart) {
      onDragStart(id, position.x, position.y);
    }
  }

  function startResize(dir: Direction) {
    return function (e: React.MouseEvent) {
      e.stopPropagation();
      resizeDir.current = dir;
    };
  }

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();

    // Handle multi-selection with Ctrl/Cmd key
    if (e.ctrlKey || e.metaKey) {
      setSelectedIds((prev) =>
        prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
      );
    } else if (!isSelected) {
      setSelectedIds([id]);
    }
  }

  useEffect(() => {
    onRefUpdate?.(id, containerRef.current);
  }, [onRefUpdate, id]);

  return (
    <div
      ref={containerRef}
      className={`absolute ${isSelected ? "border-[2px] border-[#70acdc]" : "hover:border-[2px] hover:border-[#70acdc]"} bg-transparent select-none`}
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
      }}
      onMouseDown={startDrag}
      onClick={handleClick}
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
      {isSelected && selectedIds.length < 2 && (
        <div
          className="absolute top-[-6px] left-[-6px] w-2 h-2 border border-[#70acdc] bg-[#2c2c2c] cursor-nw-resize"
          onMouseDown={startResize("top-left")}
        />
      )}
      {isSelected && selectedIds.length < 2 && (
        <div
          className="absolute top-[-6px] right-[-6px] w-2 h-2 border border-[#70acdc] bg-[#2c2c2c] cursor-ne-resize"
          onMouseDown={startResize("top-right")}
        />
      )}
      {isSelected && selectedIds.length < 2 && (
        <div
          className="absolute bottom-[-6px] left-[-6px] w-2 h-2 border border-[#70acdc] bg-[#2c2c2c] cursor-sw-resize"
          onMouseDown={startResize("bottom-left")}
        />
      )}
      {isSelected && selectedIds.length < 2 && (
        <div
          className="absolute bottom-[-6px] right-[-6px] w-2 h-2 border border-[#70acdc] bg-[#2c2c2c] cursor-se-resize"
          onMouseDown={startResize("bottom-right")}
        />
      )}
    </div>
  );
}
