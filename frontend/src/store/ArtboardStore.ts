import type { Wireframe } from "../../../interfaces/artboard";
import type { ActiveDragState } from "../routes";
import { create } from "zustand";

export type ArtboardState = {
  shapeHistory: {
    undoStack: Wireframe[][];
    redoStack: Wireframe[][];
  };
  isHandToolActive: boolean;
  setIsHandToolActive: (args: boolean) => void;
  toggleHandTool: () => void;
  handleTimeTravel: (direction: "redo" | "undo") => void;
  addUndoState: (shapes: Wireframe[]) => void;
  setTemporaryOffset: (
    temporaryOffset: null | {
      targetShapeIds: string[];
      xOffset: number;
      yOffset: number;
    }
  ) => void;
  temporaryOffset: null | {
    targetShapeIds: string[];
    xOffset: number;
    yOffset: number;
  };
  wrapperRef: React.RefObject<HTMLDivElement> | null;
  setWrapperRef: (ref: React.RefObject<HTMLDivElement>) => void;
  selectedShapeIds: Set<string>;
  setSelectedShapeIds: (ids: Set<string>) => void;
  // addSelectedShapeId: (id: string) => void;
  // removeSelectedShapeId: (id: string) => void;
  clearSelection: () => void;
  dragState: ActiveDragState | null;
  setDragState: (dragState: ActiveDragState | null) => void;
};

const useArtboardStore = create<ArtboardState>((set, get) => ({
  shapeHistory: {
    undoStack: [],
    redoStack: [],
  },
  dragState: null,
  setDragState: (dragState) => {
    set({ dragState });
  },
  handleTimeTravel: (direction) => {
    // needs to be refactored
    /*
    const { shapeHistory, shapes } = get();
    if (direction === "undo" && shapeHistory.undoStack.length > 0) {
      // pop from undo stack into state, add state to redostack
      const newState = shapeHistory.undoStack.pop();
      shapeHistory.redoStack.push(shapes);
      set({ shapeHistory, shapes: newState });
    } else if (direction === "redo" && shapeHistory.redoStack.length > 0) {
      const newState = shapeHistory.redoStack.pop();
      shapeHistory.undoStack.push(shapes);
      set({ shapeHistory, shapes: newState });
    }
    */
  },
  addUndoState: (shapes: Wireframe[]) => {
    const { shapeHistory } = get();
    shapeHistory.redoStack = [];
    shapeHistory.undoStack.push(shapes);
    set({ shapeHistory });
  },
  isHandToolActive: false,
  setIsHandToolActive: (args: boolean) => set({ isHandToolActive: args }),
  toggleHandTool: () => {
    const handToolState = get().isHandToolActive;
    set({ isHandToolActive: !handToolState });
  },
  setTemporaryOffset: (temporaryOffset) => set({ temporaryOffset }),
  temporaryOffset: null,
  wrapperRef: null,
  setWrapperRef: (ref) => set({ wrapperRef: ref }),
  selectedShapeIds: new Set<string>(),
  setSelectedShapeIds: (ids: Set<string>) => set({ selectedShapeIds: ids }),
  // addSelectedShapeId: (id: string) =>
  //   set((state) => ({
  //     selectedShapeIds: state.selectedShapeIds.add(id),
  //   })),
  // removeSelectedShapeId: (id: string) =>
  //   set((state) => ({
  //     selectedShapeIds: state.selectedShapeIds.delete(id),
  //   })),
  clearSelection: () => {
    const newSet = get().selectedShapeIds;
    newSet.clear();
    set({ selectedShapeIds: newSet });
  },
}));

export default useArtboardStore;
