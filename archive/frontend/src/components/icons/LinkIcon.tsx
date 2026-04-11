
import * as React from "react";

// Chain link icon (copy link style)
const LinkIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M10 14a5 5 0 0 1 0-7l2-2a5 5 0 0 1 7 7l-2 2" />
    <path d="M14 10a5 5 0 0 1 0 7l-2 2a5 5 0 0 1-7-7l2-2" />
  </svg>
);

export default LinkIcon;
