import logo from "/capyness.png";
import { useState } from "react";
import caretDown from "/iconcaretdown.png";
import caretRight from "/iconcaretright.png";
import ButtonComponent from "./leftnav/ButtonComponent";
import TextComponent from "./leftnav/TextComponent";

export default function LeftNav() {
  const [searchContent, setSearchContent] = useState("");
  const [showComponents, setShowComponents] = useState(true);

  return (
    <div className="fixed top-0 left-0 h-screen w-[250px] bg-zinc-900 overflow-auto arkhet-cursor">
      <div className="border-b-zinc-700 border-b-[1px] p-2  pr-10 pl-4">
        <div className="flex items-center">
          <img src={logo} alt="Logo" className="pr-2 w-[44px]" />
          <p className="font pt-1 text-lg tracking-widest">CANVAS RND</p>
        </div>
      </div>
      <div className="flex my-2 py-2 pl-4 text-sm border-b-[1px] border-b-zinc-700">
        <div className="flex justify-center items-center">
          <svg
            width="13"
            height="13"
            viewBox="0 0 8 8"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <g clipPath="url(#clip0_2642_26774)">
              <path
                d="M6.5 3.25C6.5 3.96719 6.26719 4.62969 5.875 5.16719L7.85312 7.14687C8.04844 7.34219 8.04844 7.65937 7.85312 7.85469C7.65781 8.05 7.34062 8.05 7.14531 7.85469L5.16719 5.875C4.62969 6.26875 3.96719 6.5 3.25 6.5C1.45469 6.5 0 5.04531 0 3.25C0 1.45469 1.45469 0 3.25 0C5.04531 0 6.5 1.45469 6.5 3.25ZM3.25 5.5C3.54547 5.5 3.83805 5.4418 4.11104 5.32873C4.38402 5.21566 4.63206 5.04992 4.84099 4.84099C5.04992 4.63206 5.21566 4.38402 5.32873 4.11104C5.4418 3.83805 5.5 3.54547 5.5 3.25C5.5 2.95453 5.4418 2.66194 5.32873 2.38896C5.21566 2.11598 5.04992 1.86794 4.84099 1.65901C4.63206 1.45008 4.38402 1.28434 4.11104 1.17127C3.83805 1.0582 3.54547 1 3.25 1C2.95453 1 2.66194 1.0582 2.38896 1.17127C2.11598 1.28434 1.86794 1.45008 1.65901 1.65901C1.45008 1.86794 1.28434 2.11598 1.17127 2.38896C1.0582 2.66194 1 2.95453 1 3.25C1 3.54547 1.0582 3.83805 1.17127 4.11104C1.28434 4.38402 1.45008 4.63206 1.65901 4.84099C1.86794 5.04992 2.11598 5.21566 2.38896 5.32873C2.66194 5.4418 2.95453 5.5 3.25 5.5Z"
                fill="currentColor"
              />
            </g>
            <defs>
              <clipPath id="clip0_2642_26774">
                <rect width="8" height="8" fill="currentColor" />
              </clipPath>
            </defs>
          </svg>
          <input
            type="text"
            className="mt-1 font pl-3 bg-transparent outline-none"
            placeholder="Search..."
            onChange={(e) => setSearchContent(e.target.value)}
          />
        </div>
      </div>
      <div className="pl-4 pb-2 border-b border-b-[#303030]">
        {!showComponents && (
          <div
            className="flex w-[200px] py-2 cursor-pointer"
            onClick={() => setShowComponents(true)}
          >
            <img
              src={caretRight}
              alt=""
              className="mr-2 h-[15px] w-[7px] pt-2"
            />
            <p>Basic Components</p>
          </div>
        )}
        {showComponents && (
          <div
            className="flex w-[200px] py-2 cursor-pointer"
            onClick={() => setShowComponents(false)}
          >
            <img src={caretDown} alt="" className="mr-2 w-[10px] py-2" />
            <p>Basic Components</p>
          </div>
        )}
        {showComponents && (
          <div className="grid grid-cols-3 gap-2 pr-4 pb-2">
            <ButtonComponent />
            <TextComponent />
          </div>
        )}
      </div>
    </div>
  );
}
