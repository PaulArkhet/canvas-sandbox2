import * as React from "react";
import { Outlet, createRootRoute } from "@tanstack/react-router";
import { ViewProvider } from "../components/zoom/ViewContext";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <ViewProvider>
      <Outlet />
    </ViewProvider>
  );
}
