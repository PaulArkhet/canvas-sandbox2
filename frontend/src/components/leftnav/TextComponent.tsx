export default function TextComponent() {
  return (
    <div className="justify-center items-center flex hover:text-[#42A5F5] hover:bg-[#202020] rounded pt-4 transition-all ease-in-out duration-200 cursor-pointer">
      <button>
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M11.3393 0.928571C11.1295 0.370536 10.5938 0 10 0C9.40625 0 8.87054 0.370536 8.66071 0.928571L2.58036 17.1429H1.42857C0.638393 17.1429 0 17.7812 0 18.5714C0 19.3616 0.638393 20 1.42857 20H5.71429C6.50446 20 7.14286 19.3616 7.14286 18.5714C7.14286 17.7812 6.50446 17.1429 5.71429 17.1429H5.63393L6.4375 15H13.5625L14.3661 17.1429H14.2857C13.4955 17.1429 12.8571 17.7812 12.8571 18.5714C12.8571 19.3616 13.4955 20 14.2857 20H18.5714C19.3616 20 20 19.3616 20 18.5714C20 17.7812 19.3616 17.1429 18.5714 17.1429H17.4196L11.3393 0.928571ZM12.4911 12.1429H7.50893L10 5.49554L12.4911 12.1429Z"
            fill="currentColor"
          />
        </svg>
        <p className="text-xs pt-5 pb-2">
          <span className="font-bold">T</span>ext
        </p>
      </button>
    </div>
  );
}
