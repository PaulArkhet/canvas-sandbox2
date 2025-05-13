import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { Link, RouterProvider, createRouter } from "@tanstack/react-router";
import "./index.css";

import { routeTree } from "./routeTree.gen";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export const queryClient = new QueryClient();
const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultNotFoundComponent: () => {
    return (
      <main className="flex-1 bg-[#242424] p-3 pt-[100px] text-white">
        <p className="pt-10 text-center text-xl text-white md:pt-32 md:text-4xl">
          Whoops! This isn't what you're looking for 😅
        </p>
        <div className="mx-auto my-10 flex w-[250px] flex-col md:my-20">
          <Link
            to="/"
            className="nunitofont rounded bg-[#9253E4] px-10 py-2 text-center tracking-widest"
          >
            LET'S GO HOME
          </Link>
        </div>
      </main>
    );
  },
});

// Register the router instance for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// Render the app
const rootElement = document.getElementById("root")!;
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>
  );
}
