import LeftNav from "./components/LeftNav";
import ResizeAndDrag from "./components/ResizeAndDrag";
import RightNav from "./components/RightNav";
import TopNav from "./components/TopNav";

function App() {
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

export default App;
