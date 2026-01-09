
import * as React from "react";

// Material Design 'link' icon SVG
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
    <path d="M3.9 12a5 5 0 0 1 5-5h3" />
    <path d="M14.1 12a5 5 0 0 0-5 5h-3" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </svg>
);

export default LinkIcon;
