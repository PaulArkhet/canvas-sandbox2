import {
  createContext,
  useCallback,
  useMemo,
  useRef,
  type PropsWithChildren,
} from "react";

type Pos = { x: number; y: number };
type Snap = { scale: number }; // what consumers care about

interface ViewContextType {
  /* --- reactive part (used with useSyncExternalStore) ---------- */
  getSnapshot: () => Snap;
  subscribe: (cb: () => void) => () => void;

  /* --- imperative helpers ------------------------------------- */
  pan: (d: Pos) => void;
  scaleAt: (at: Pos, factor: number) => void;
  setScale: (newScale: number) => void;

  /* --- refs you may want elsewhere ----------------------------- */
  pos: React.MutableRefObject<Pos>;
}

export const ViewContext = createContext<ViewContextType | null>(null);

export function ViewProvider({ children }: PropsWithChildren) {
  /* ------------------------------------------------------------------
   *  1.  Mutable data that changes very often → useRef ()
   * ----------------------------------------------------------------- */
  const posRef = useRef<Pos>({ x: 0, y: 0 });
  const scaleRef = useRef(1);

  /* ------------------------------------------------------------------
   *  2.  Small pub/sub system so components can *opt‑in* to scale changes
   * ----------------------------------------------------------------- */
  const listeners = useRef(new Set<() => void>());

  const getSnapshot = useCallback<() => Snap>(
    () => ({ scale: scaleRef.current }),
    []
  );

  const subscribe = useCallback<(cb: () => void) => () => void>((cb) => {
    listeners.current.add(cb);
    return () => listeners.current.delete(cb);
  }, []);

  /* rAF throttle so we never notify more than once per frame */
  const scheduleNotify = (() => {
    let raf = 0;
    return () => {
      if (!raf) {
        raf = requestAnimationFrame(() => {
          raf = 0;
          listeners.current.forEach((cb) => cb());
        });
      }
    };
  })();

  /* ------------------------------------------------------------------
   *  3.  Imperative helpers
   * ----------------------------------------------------------------- */
  const pan = useCallback(({ x, y }: Pos) => {
    posRef.current.x += x;
    posRef.current.y += y;
    /*   NO React render here – parent updates its DOM transform by itself */
  }, []);

  const scaleAt = useCallback((at: Pos, factor: number) => {
    /* adjust pos so the zoom stays centered on the cursor */
    posRef.current = {
      x: at.x - (at.x - posRef.current.x) * factor,
      y: at.y - (at.y - posRef.current.y) * factor,
    };
    scaleRef.current *= factor;

    /* notify *once* next frame that scale changed */
    scheduleNotify();
  }, []);

  const setScale = useCallback((newScale: number) => {
    (scaleRef.current = newScale), scheduleNotify();
  }, []);

  /* ------------------------------------------------------------------
   *  4.  Stable context value  (created exactly once)
   * ----------------------------------------------------------------- */
  const value = useMemo<ViewContextType>(
    () => ({
      /* reactive */
      getSnapshot,
      subscribe,
      /* imperative */
      pan,
      scaleAt,
      setScale,
      /* refs */
      pos: posRef,
    }),
    [getSnapshot, subscribe, pan, scaleAt]
  );

  return <ViewContext.Provider value={value}>{children}</ViewContext.Provider>;
}
