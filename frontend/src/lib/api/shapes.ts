import type { MutableRefObject } from "react";
import type {
  ShapeVariations,
  Wireframe,
} from "../../../../interfaces/artboard";
import { client } from "./client";
import {
  QueryClient,
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { getCurrentViewCenter } from "../../utils/helpers";
import { match } from "ts-pattern";
import { findOpenSpaceForPage } from "../../utils/findOpenSpace";

type CreateShapeArgs = {
  type: ShapeVariations["type"];
  shapeId: string;
  canvasRef: MutableRefObject<HTMLDivElement | null>;
  scale: number;
  shapeCount: number;
};

function getDimensionPropsForShape(type: ShapeVariations["type"]): {
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  maxWidth: number | null;
  maxHeight: number | null;
} {
  return {
    maxWidth: null,
    maxHeight: null,
    ...match(type)
      .with("page", () => ({
        width: 1000, // 800 * 2
        height: 562, // 448 * 2
        minWidth: 461,
        minHeight: 562,
        maxWidth: 1000,
      }))
      .with("button", () => ({
        width: 144,
        height: 29,
        minWidth: 114,
        minHeight: 23,
      }))
      .with("text", () => ({
        width: 150,
        height: 50,
        minWidth: 49,
        minHeight: 20,
      }))
      .exhaustive(),
  };
}

function getDefaultShapeProps<T extends ShapeVariations["type"]>(
  type: T,
  shapeCount: number,
  scale: number,
  viewCenter: { x: number; y: number },
  newShapeId: string,
  parentId?: string,
  leadingIcon?: string,
  trailingIcon?: string
): Wireframe {
  const dimensionProps = getDimensionPropsForShape(type);
  const baseProps = {
    ...dimensionProps,
    id: newShapeId,
    shapeId: newShapeId,
    isInstanceChild: false,
    zIndex: type === "page" ? 0 : shapeCount + 1,
    xOffset: viewCenter.x / scale - dimensionProps.width / 2,
    yOffset: viewCenter.y / scale - dimensionProps.height / 2,
  };
  let shape: Wireframe;
  switch (type) {
    case "page": {
      const page: Extract<Wireframe, { type: "page" }> = {
        ...baseProps,
        subtype: "Desktop",
        title: "New Page",
        description: "Add a description to help document your wireframes",
        type: "page",
      };
      shape = page;
      break;
    }
    case "button": {
      const button: Extract<Wireframe, { type: "button" }> = {
        ...baseProps,
        title: "Confirm",
        subtype: "Primary",
        size: "Medium",
        textAlign: "center",
        type: "button",
        fontWeight: "normal",
        fontStyle: "normal",
        textDecoration: "none",
        leadingIcon: leadingIcon || null,
        trailingIcon: trailingIcon || null,
        pageId: null,
      };
      shape = button;
      break;
    }
    case "text": {
      const text: Extract<Wireframe, { type: "text" }> = {
        ...baseProps,
        fontSize: "text-sm",
        fontColor: "text-white",
        content: "Double click to edit...",
        isBold: false,
        isItalic: false,
        isUnderlined: false,
        isStrikethrough: false,
        alignment: "left",
        widthMode: "fixed-size",
        type: "text",
        pageId: null,
      };
      shape = text;
      break;
    }
    default:
      throw new Error(`Unsupported shape type: ${type}`);
  }
  return { ...shape };
}

function calculateInitialPosition(
  type: ShapeVariations["type"],
  shapeCount: number,
  scale: number,
  canvasRef: MutableRefObject<HTMLDivElement | null>,
  shapeId: string,
  allShapes: Wireframe[] | undefined
) {
  let initialPosition = getCurrentViewCenter(canvasRef);

  if (type === "page" && allShapes) {
    const dummyPage = getDefaultShapeProps(
      "page",
      shapeCount,
      scale,
      initialPosition,
      shapeId
    );
    const openSpace = findOpenSpaceForPage(allShapes, dummyPage);
    initialPosition = {
      x: (openSpace.xOffset + 500) * scale,
      y: (openSpace.yOffset + 280) * scale,
    };
  }
  console.log("init", initialPosition);
  return initialPosition;
}

async function getAllShapes(): Promise<Wireframe[]> {
  const res = await client.api.v0.shapes.$get();
  if (!res.ok) {
    throw new Error("Error while getting shapes for project");
  }
  const { shape } = await res.json();
  console.log("response from query/all shapes:", shape);
  return shape;
}

export const getAllShapesQueryOptions = () =>
  queryOptions({
    queryKey: ["shapes"],
    queryFn: () => getAllShapes(),
    staleTime: 5000,
  });

async function createShape(
  createShapeArgs: CreateShapeArgs,
  queryClient: QueryClient
) {
  const allShapes = queryClient.getQueryData<Wireframe[] | undefined>([
    "shapes",
  ]);

  // this shape should exist from the onMutate, we can use those props
  const positionedShape = allShapes!.find(
    (shape) => shape.id === createShapeArgs.shapeId
  )!;

  let pageId: string | null = null;
  if (allShapes) {
    const pages = allShapes.filter((shape) => shape.type === "page");
    const closestPage = pages.find((page) => {
      return (
        positionedShape.xOffset >= page.xOffset &&
        positionedShape.yOffset >= page.yOffset &&
        positionedShape.xOffset + positionedShape.width <=
          page.xOffset + page.width &&
        positionedShape.yOffset + positionedShape.height <=
          page.yOffset + page.height
      );
    });
    if (closestPage) {
      pageId = closestPage.id;
    }
  }

  console.log("Creating shape: ", positionedShape);
  const res = await client.api.v0.shapes.create.$post({
    json: {
      ...positionedShape,
      ...(pageId !== null && { pageId }),
    },
  });

  if (!res.ok) {
    throw new Error("Error while creating shape");
  }

  const { shape } = await res.json();
  return shape;
}

export const useCreateShapeMutation = () => {
  const queryClient = useQueryClient();
  const queryKey = ["shapes"];

  return useMutation({
    mutationFn: (args: Omit<CreateShapeArgs, "shapeCount">) => {
      const allShapes = queryClient.getQueryData<Wireframe[] | undefined>(
        queryKey
      );

      if (!allShapes) {
        throw new Error("No shapes...");
      }
      const shapeCount = allShapes ? allShapes.length : 0;

      return createShape({ ...args, shapeCount }, queryClient);
    },
    onMutate: async (newShapeArgs) => {
      console.log("RUNNING MUT");
      await queryClient.cancelQueries({ queryKey });

      const previousShapes =
        queryClient.getQueryData<Wireframe[]>(queryKey) || [];

      const allShapes = queryClient.getQueryData<Wireframe[] | undefined>(
        queryKey
      );
      const shapeCount = allShapes ? allShapes.length : 0;

      console.log("running in on mutate shape");
      const initialPosition = calculateInitialPosition(
        newShapeArgs.type,
        shapeCount,
        newShapeArgs.scale,
        newShapeArgs.canvasRef,
        newShapeArgs.shapeId,
        allShapes
      );

      const shape = getDefaultShapeProps(
        newShapeArgs.type,
        shapeCount,
        newShapeArgs.scale,
        initialPosition,
        newShapeArgs.shapeId
      );

      let pageId: string | null = null;
      if (allShapes) {
        const pages = allShapes.filter((shape) => shape.type === "page");
        const closestPage = pages.find((page) => {
          return (
            shape.xOffset >= page.xOffset &&
            shape.yOffset >= page.yOffset &&
            shape.xOffset + shape.width <= page.xOffset + page.width &&
            shape.yOffset + shape.height <= page.yOffset + page.height
          );
        });
        if (closestPage) {
          pageId = closestPage.id;
        }
      }

      if ("pageId" in shape) {
        shape.pageId = pageId;
      }

      if (!allShapes) {
        console.error("No shapes, returning...");
        return Promise.resolve();
      }

      queryClient.setQueryData<Wireframe[]>(queryKey, [
        ...previousShapes,
        shape,
      ]);

      return { previousShapes, newShape: shape };
    },
    onError: (err, _newShapeArgs, context) => {
      if (context?.previousShapes) {
        queryClient.setQueryData<Wireframe[]>(
          ["shapes"],
          context.previousShapes
        );
      }
      console.error("Error creating shape:", err);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["shapes"] });
    },
  });
};
