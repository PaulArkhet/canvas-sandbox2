import type { MutableRefObject } from "react";

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

  return (
    <div className="justify-center items-center flex hover:text-[#42A5F5] hover:bg-[#202020] rounded pt-5 transition-all ease-in-out duration-200 cursor-pointer">
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
