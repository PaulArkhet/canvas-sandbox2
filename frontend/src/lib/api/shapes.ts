import { useRef, type MutableRefObject } from "react";
import type {
  ShapeVariations,
  Wireframe,
} from "../../../../interfaces/artboard";
import { client, type ArgumentTypes } from "./client";
import {
  QueryClient,
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { getCurrentViewCenter } from "../../utils/helpers";
import { match } from "ts-pattern";
import { findOpenSpaceForPage } from "../../utils/findOpenSpace";
import { v4 as uuid } from "uuid";

type CreateShapeArgs = {
  type: ShapeVariations["type"];
  shapeId: string;
  canvasRef: MutableRefObject<HTMLDivElement | null>;
  scale: number;
  shapeCount: number;
};

const updateClientFunction = client.api.v0.shapes[":shapeId"];

type UpdateShapeArgs = ArgumentTypes<
  typeof updateClientFunction.update.$post
>[0]["json"];

export type BatchUpdateShapeArgs = {
  shapeId: string;
  args: UpdateShapeArgs;
};

export type ShapeBatchUpdateItem = {
  shapeId: string;
  args: UpdateShapeArgs;
};

const retryDelay = 500;
const retryLimit = 10;

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

async function updateShape(
  updateShapeArgs: {
    args: UpdateShapeArgs;
    shapeId: string;
  },
  retryCount: number = 0
) {
  try {
    console.log(updateShapeArgs.args);
    const res = await updateClientFunction.update.$post({
      json: updateShapeArgs.args,
      param: { shapeId: updateShapeArgs.shapeId.toString() },
    });

    if (res.status === 404) {
      if (retryCount > 0) {
        console.log(
          `Shape ${updateShapeArgs.shapeId} confirmed missing, giving up after retry`
        );
      }

      const delay = (retryCount + 1) * (2 * retryDelay);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return updateShape(updateShapeArgs, retryCount + 1);
    }

    if (!res.ok) {
      console.error(res);
      throw new Error("Error while updating shape");
    }
  } catch (error) {
    console.error(`Error updating shape ${updateShapeArgs.shapeId}:`, error);
    throw error;
  }
}

export const useUpdateShapeMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateShape,
    onMutate: async (updateArgs) => {
      await queryClient.cancelQueries({ queryKey: ["shapes"] });
      const previousShapes =
        queryClient.getQueryData<Wireframe[]>(["shapes"]) || [];
      const previousShape = previousShapes.find(
        (shape) => shape.id === updateArgs.shapeId
      );

      if (!previousShape) {
        return { previousShapes };
      }

      let determinedPageId: string | null = null;
      let positionUpdated = false;

      if (
        previousShape.type !== "page" &&
        (updateArgs.args.xOffset !== undefined ||
          updateArgs.args.yOffset !== undefined)
      ) {
        positionUpdated = true;
        const allShapes = [...previousShapes];
        const updatedShape = {
          ...previousShape,
          ...updateArgs.args,
        };

        const pages = allShapes.filter((shape) => shape.type === "page");
        let isInsidePage = false;

        for (const page of pages) {
          const shapeX = updatedShape.xOffset ?? previousShape.xOffset;
          const shapeY = updatedShape.yOffset ?? previousShape.yOffset;
          const shapeWidth = updatedShape.width ?? previousShape.width;
          const shapeHeight = updatedShape.height ?? previousShape.height;

          if (
            shapeX >= page.xOffset &&
            shapeY >= page.yOffset &&
            shapeX + shapeWidth <= page.xOffset + page.width &&
            shapeY + shapeHeight <= page.yOffset + page.height
          ) {
            determinedPageId = page.id;
            isInsidePage = true;
            break;
          }
        }

        if (!isInsidePage) {
          determinedPageId = null;
        }

        updateArgs = {
          shapeId: updateArgs.shapeId,
          args: {
            ...updateArgs.args,
            // @ts-ignore
            ...(previousShape.type !== "page" && { pageId: determinedPageId }),
          },
        };
      }

      const newShapes = previousShapes.map((shape) => {
        if (shape.id !== updateArgs.shapeId) {
          return shape;
        }

        if (shape.type === "page") {
          return {
            ...shape,
            ...updateArgs.args,
          } as Wireframe;
        } else {
          let finalPageId: string | null;

          if (positionUpdated) {
            finalPageId = determinedPageId;
          } else if (
            "pageId" in updateArgs.args &&
            updateArgs.args.pageId !== undefined
          ) {
            finalPageId = updateArgs.args.pageId as string | null;
          } else if ("pageId" in shape) {
            finalPageId = shape.pageId;
          } else {
            finalPageId = null;
          }

          return {
            ...shape,
            ...updateArgs.args,
            pageId: finalPageId,
          } as Wireframe;
        }
      });

      queryClient.setQueryData<Wireframe[]>(["shapes"], newShapes);

      return { previousShapes, previousShape };
    },
    onError: (err, _updateArgs, context) => {
      if (context?.previousShapes) {
        queryClient.setQueryData<Wireframe[]>(
          ["shapes"],
          context.previousShapes
        );
      }
      console.error("Error updating shape:", err);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["shapes"] });
    },
  });
};

async function batchUpdateShapes(
  updateBatchArgs: ShapeBatchUpdateItem[],
  retryCount: number = 0
) {
  try {
    const res = await client.api.v0.shapes["batch-update"].$post({
      json: updateBatchArgs,
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "Unknown error");
      console.error("Batch update error response:", errorText);

      if ((res.status as number) === 404 && retryCount < retryLimit) {
        const delay = (retryCount + 1) * (2 * retryDelay);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return batchUpdateShapes(updateBatchArgs, retryCount + 1);
      }

      throw new Error("Error while batch updating shapes");
    }

    const response = await res.json();
    return response;
  } catch (error) {
    console.error("Error in batch update shapes:", error);
    throw error;
  }
}

export function useBatchUpdateShapesMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: batchUpdateShapes,
    onMutate: async (batchUpdateArgs: ShapeBatchUpdateItem[]) => {
      await queryClient.cancelQueries({ queryKey: ["shapes"] });

      const previousShapes =
        queryClient.getQueryData<Wireframe[]>(["shapes"]) || [];

      let newShapes = [...previousShapes];
      const appliedUpdates = new Map<string, UpdateShapeArgs>();

      for (const updateArgs of batchUpdateArgs) {
        const { shapeId, args } = updateArgs;
        const previousShape = previousShapes.find(
          (shape) => shape.id === shapeId
        );

        if (!previousShape) {
          continue;
        }

        let determinedPageId: string | null = null;
        let positionUpdated = false;

        if (
          previousShape.type !== "page" &&
          (args.xOffset !== undefined || args.yOffset !== undefined)
        ) {
          positionUpdated = true;
          const updatedShape = {
            ...previousShape,
            ...args,
          };

          const pages = previousShapes.filter((shape) => shape.type === "page");
          let isInsidePage = false;

          for (const page of pages) {
            const shapeX = updatedShape.xOffset ?? previousShape.xOffset;
            const shapeY = updatedShape.yOffset ?? previousShape.yOffset;
            const shapeWidth = updatedShape.width ?? previousShape.width;
            const shapeHeight = updatedShape.height ?? previousShape.height;

            if (
              shapeX >= page.xOffset &&
              shapeY >= page.yOffset &&
              shapeX + shapeWidth <= page.xOffset + page.width &&
              shapeY + shapeHeight <= page.yOffset + page.height
            ) {
              determinedPageId = page.id;
              isInsidePage = true;
              break;
            }
          }

          if (!isInsidePage) {
            determinedPageId = null;
          }

          const updatedProperties = {
            ...args,
            ...((previousShape.type as string) !== "page" && {
              pageId: determinedPageId,
            }),
          };

          appliedUpdates.set(shapeId, updatedProperties);
        } else {
          appliedUpdates.set(shapeId, args);
        }
      }

      newShapes = previousShapes.map((shape) => {
        const updatedProperties = appliedUpdates.get(shape.id);

        if (!updatedProperties) {
          return shape;
        }

        if (shape.type === "page") {
          return {
            ...shape,
            ...updatedProperties,
          } as Wireframe;
        } else {
          let finalPageId: string | null;
          const positionUpdated =
            updatedProperties.xOffset !== undefined ||
            updatedProperties.yOffset !== undefined;

          if (positionUpdated && appliedUpdates.has(shape.id)) {
            const updatedProps = appliedUpdates.get(shape.id)!;
            finalPageId =
              "pageId" in updatedProps
                ? (updatedProps.pageId as string | null)
                : null;
          } else if (
            "pageId" in updatedProperties &&
            updatedProperties.pageId !== undefined
          ) {
            finalPageId = updatedProperties.pageId as string | null;
          } else if ("pageId" in shape) {
            finalPageId = shape.pageId;
          } else {
            finalPageId = null;
          }

          return {
            ...shape,
            ...updatedProperties,
            pageId: finalPageId,
          } as Wireframe;
        }
      });

      queryClient.setQueryData<Wireframe[]>(["shapes"], newShapes);

      return { previousShapes, appliedUpdates };
    },
    onError: (err, _batchUpdateArgs, context) => {
      if (context?.previousShapes) {
        queryClient.setQueryData<Wireframe[]>(
          ["shapes"],
          context.previousShapes
        );
      }
      console.error("Error updating shapes in batch:", err);
    },
    onSuccess: (data, _batchUpdateArgs, context) => {
      if (data.results && !data.success) {
        const failedShapeIds = data.results
          .filter((result) => !result.success)
          .map((result) => result.shapeId);

        if (failedShapeIds.length > 0) {
          console.warn("Some shapes failed to update:", failedShapeIds);

          if (context?.previousShapes) {
            const currentShapes =
              queryClient.getQueryData<Wireframe[]>(["shapes"]) || [];

            const partiallyFixedShapes = currentShapes.map((shape) => {
              if (failedShapeIds.includes(shape.id)) {
                const previousShape = context.previousShapes.find(
                  (s) => s.id === shape.id
                );
                return previousShape || shape;
              }
              return shape;
            });

            queryClient.setQueryData<Wireframe[]>(
              ["shapes"],
              partiallyFixedShapes
            );
          }
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["shapes"] });
    },
  });
}

export function useShapeBatchOperations() {
  const batchUpdateMutation = useBatchUpdateShapesMutation();
  const singleUpdateMutation = useUpdateShapeMutation();
  const queryClient = useQueryClient();
  const dragOperationInProgressRef = useRef(false);

  // Helper function to decide whether to use batch or single update
  const updateShapes = (
    updates: ShapeBatchUpdateItem[] | ShapeBatchUpdateItem,
    options?: { isDragOperation?: boolean; skipInvalidation?: boolean }
  ) => {
    // Track if this is a drag operation
    if (options?.isDragOperation) {
      dragOperationInProgressRef.current = true;

      // Clear the flag after animations complete
      setTimeout(() => {
        dragOperationInProgressRef.current = false;
      }, 500);
    }

    if (Array.isArray(updates)) {
      if (updates.length === 1) {
        console.log("len, 1", updates);
        // If there's only one update, use the single update function
        return singleUpdateMutation.mutate({
          shapeId: updates[0].shapeId,
          args: updates[0].args,
        });
      } else if (updates.length > 1) {
        console.log("updates more than 1", updates);
        // If there are multiple updates, use the batch update
        return batchUpdateMutation.mutate(updates);
      }
    } else {
      console.log("updates 1, no len", updates);
      // If it's a single update object, use the single update function
      return singleUpdateMutation.mutate({
        shapeId: updates.shapeId,
        args: updates.args,
      });
    }
  };

  return {
    updateShapes,
    isUpdating: batchUpdateMutation.isPending || singleUpdateMutation.isPending,
    isError: batchUpdateMutation.isError || singleUpdateMutation.isError,
    error: batchUpdateMutation.error || singleUpdateMutation.error,
    reset: () => {
      batchUpdateMutation.reset();
      singleUpdateMutation.reset();
    },
  };
}

export const useAltDragCopyMutation = () => {
  const queryClient = useQueryClient();
  const queryKey = ["shapes"];

  return useMutation({
    mutationFn: async ({ shapesToCopy }: { shapesToCopy: Wireframe[] }) => {
      const processedShapes = shapesToCopy.map((shape) => {
        const processed = { ...shape } as Wireframe;

        // @ts-ignore
        if (shape.type === "checkbox" && shape.options) {
          // @ts-ignore
          processed.options = (shape as Wireframe).options.map(
            (option: Wireframe) => ({
              ...option,
              optionId: uuid(),
            })
          );
        }

        // @ts-ignore
        if (shape.type === "radio" && shape.radioOptions) {
          // @ts-ignore
          processed.radioOptions = (shape as Wireframe).radioOptions.map(
            (option: Wireframe, index: number) => ({
              ...option,
              id: uuid(),
              // @ts-ignore
              order: option.order !== undefined ? option.order : index,
            })
          );
        }

        return processed;
      });

      const bulkResponse = await client.api.v0.shapes.copy.$post({
        json: { shapes: processedShapes },
      });

      if (!bulkResponse.ok) throw new Error("Failed to copy shapes");
      return bulkResponse.json();
    },
    onMutate: ({ shapesToCopy }) => {
      queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Wireframe[]>(queryKey) || [];

      const processedShapes = shapesToCopy.map((shape) => {
        const processed = { ...shape } as any;
        return processed;
      });

      queryClient.setQueryData(queryKey, [...previous, ...processedShapes]);
      return { previous };
    },
    onError: (_, __, context) => {
      context?.previous && queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });
};
