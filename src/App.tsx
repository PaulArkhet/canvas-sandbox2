import ResizeAndDrag from "./components/ResizeAndDrag";

function App() {
  return (
    <div className="flex flex-col min-h-screen bg-gray-100 relative">
      <ResizeAndDrag>
        <button className="pointer-events-auto">BUTTON</button>
      </ResizeAndDrag>
    </div>
  );
}

export default App;
