import type { Wireframe } from "../../../../interfaces/artboard";
import { client } from "./client";
import { queryOptions } from "@tanstack/react-query";

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
