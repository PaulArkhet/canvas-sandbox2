import { useContext, useSyncExternalStore, type MutableRefObject } from "react";
import { useCreateShapeMutation } from "../../lib/api/shapes";
import { ViewContext } from "../zoom/ViewContext";
import { v4 } from "uuid";

export type ComponentProps = {
  canvasRef: MutableRefObject<HTMLDivElement | null>;
  projectId: number;
};

export const handleDragStart = (event: React.DragEvent, type: string) => {
  event.dataTransfer.setData("application/json", JSON.stringify({ type }));
};

export default function ButtonComponent(props: {
  canvasRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { canvasRef } = props;
  const { mutate: handleAddShape } = useCreateShapeMutation();

  const ctx = useContext(ViewContext);
  if (!ctx) throw new Error("ZoomableComponent must be inside <ViewProvider>");

  const scale = useSyncExternalStore(
    ctx.subscribe,
    () => ctx.getSnapshot().scale
  );

  return (
    <div
      className="justify-center items-center flex hover:text-[#42A5F5] hover:bg-[#202020] rounded pt-5 transition-all ease-in-out duration-200 cursor-pointer"
      draggable
      onDragStart={(e) => {
        handleDragStart(e, "button");
      }}
      onClick={() => {
        handleAddShape({
          type: "button",
          canvasRef,
          scale: scale,
          shapeId: v4(),
        });
      }}
    >
      <button>
        <svg
          width="46"
          height="17"
          viewBox="0 0 46 17"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="46" height="17" rx="3" fill="currentColor" />
        </svg>
        <p className="text-xs pt-5 pb-2">
          <span className="font-extrabold">B</span>utton
        </p>
      </button>
    </div>
  );
}
