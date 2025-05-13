import {
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { ViewContext } from "./ViewContext";
import { twMerge } from "tailwind-merge";
import useArtboardStore from "../../store/ArtboardStore";
import { zoomAt } from "./ZoomableComponent";

export function ZoomBadge() {
  const [show, setShow] = useState(false);
  const [prevScale, setPrevScale] = useState(0);
  const view = useContext(ViewContext);
  if (!view) {
    throw new Error("ZoomableComponent must be used within a ViewProvider");
  }
  const { scaleAt } = view;
  const { wrapperRef } = useArtboardStore();

  const ctx = useContext(ViewContext);
  if (!ctx) throw new Error("ZoomableComponent must be inside <ViewProvider>");

  const scale = useSyncExternalStore(
    ctx.subscribe,
    () => ctx.getSnapshot().scale
  );

  useEffect(() => {
    if (scale !== prevScale) {
      setShow(true);
      const timeout = setTimeout(() => {
        setShow(false);
        scale && setPrevScale(scale);
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [scale, show, prevScale]);

  return (
    scale && (
      <div
        className={twMerge(
          "absolute bottom-10 right-72 z-[999] bg-[#404040] rounded drop-shadow-lg transition-opacity ease-out flex arkhet-cursor"
        )}
      >
        <div
          className="px-3 py-1 border-r-2 border-r-[#5D5D5D] text-xl font-bold cursor-pointer"
          onClick={() =>
            zoomAt(
              //@ts-ignore
              wrapperRef || useRef<HTMLDivElement>(null),
              scaleAt,
              1 / 1.05
            )
          }
        >
          -
        </div>
        <p className="font-semibold px-3 pt-2 border-r-2 border-r-[#5D5D5D]">
          {(scale * 100).toFixed(0)}%
        </p>
        <div
          className="px-3 py-1 text-xl font-bold cursor-pointer"
          onClick={() =>
            //@ts-ignore
            zoomAt(wrapperRef || useRef<HTMLDivElement>(null), scaleAt, 1.05)
          }
        >
          +
        </div>
      </div>
    )
  );
}
