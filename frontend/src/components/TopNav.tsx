import { useState } from "react";
import HandToolIcon from "./topnav/HandToolIcon";
import PageIcon from "./topnav/PageIcon";
import ArrowIcon from "./topnav/ArrowIcon";

export default function TopNav() {
  const [isHandToolActive, setIsHandToolActive] = useState(false);
  return (
    <div
      className={`fixed top-0 left-[250px] w-[25%] sm:w-[45%] md:w-[50%] lg:w-[calc(100%_-_500px)] bg-[#242424] border-b border-b-zinc-700 flex items-center justify-between ${
        isHandToolActive ? "cursor-grab" : "arkhet-cursor"
      } z-[9999]`}
    >
      <div>
        <button
          className={`ml-5 py-2 px-2 pl-3 rounded ${
            !isHandToolActive && "bg-zinc-600"
          }`}
          onClick={() => setIsHandToolActive(false)}
        >
          <ArrowIcon />
        </button>
        <button
          //   onClick={() =>
          //     handleAddShape({
          //       type: "page",
          //       canvasRef,
          //       scale: scale,
          //       projectId: project.projectId,
          //       shapeId: v4(),
          //     })
          //   }
          className="py-5 px-2"
        >
          <PageIcon />
        </button>
        <button
          className={`py-2 px-2 rounded ${
            isHandToolActive ? "bg-zinc-600" : ""
          }`}
        >
          <HandToolIcon />
        </button>
      </div>
      <div className="py-7 bg-[#242424]"></div>
      <div className="ml-auto mr-auto absolute left-[40%] top-[3%] flex flex-row items-center justify-center mt-2">
        <div className="flex flex-col gap-1 items-center justify-center">
          <p className="text-[15px] text-center px-8 py-3 mr-2 rounded-t-sm tracking-[1px] cursor-pointer bg-[#2C2C2C]">
            TAB 1
          </p>
        </div>
        <div className="">
          <div className="flex relative z-30 text-[15px] text-center pl-8 pr-4 py-3 ml-2 rounded-t-sm tracking-[1px] cursor-pointer bg-[#2C2C2C]">
            <div className="mr-[20px]">TAB 2</div>
          </div>
        </div>
      </div>
    </div>
  );
}
