import * as React from "react";

const LinkIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 20 20"
    fill="currentColor"
    aria-hidden="true"
    {...props}
  >
    <path
      fillRule="evenodd"
      d="M12.293 7.293a1 1 0 011.414 0l2 2a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 010-1.414l5-5zm-1.586 1.586l-5 5a3 3 0 104.242 4.242l5-5a3 3 0 10-4.242-4.242z"
      clipRule="evenodd"
    />
  </svg>
);

export default LinkIcon;
