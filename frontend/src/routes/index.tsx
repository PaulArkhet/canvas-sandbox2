import { createFileRoute } from "@tanstack/react-router";
import ResizeAndDrag from "../components/ResizeAndDrag";
import LeftNav from "../components/LeftNav";
import TopNav from "../components/TopNav";
import RightNav from "../components/RightNav";

export const Route = createFileRoute("/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="flex flex-col min-h-screen bg-[#2c2c2c] relative text-white">
      <ResizeAndDrag>
        <button className="pointer-events-auto">BUTTON</button>
      </ResizeAndDrag>
      <LeftNav />
      <TopNav />
      <RightNav />
    </div>
  );
}
