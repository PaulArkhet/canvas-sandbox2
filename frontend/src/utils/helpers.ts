import type { MutableRefObject } from "react";

export function getCurrentViewCenter(
  canvasRef: MutableRefObject<HTMLDivElement | null>
): { x: number; y: number } {
  if (!canvasRef.current) {
    console.warn("Canvas reference is not set yet.");
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  }

  const canvasRect = canvasRef.current.getBoundingClientRect();

  const viewportCenterY = window.scrollY + window.innerHeight / 2;
  const viewportCenterX = window.scrollX + window.innerWidth / 2;

  const centerXRelativeToCanvas = viewportCenterX - canvasRect.left;
  const centerYRelativeToCanvas = viewportCenterY - canvasRect.top;

  const result = {
    x: centerXRelativeToCanvas,
    y: centerYRelativeToCanvas,
  };
  return result;
}
