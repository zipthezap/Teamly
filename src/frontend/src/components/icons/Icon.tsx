/**
 * Generic Icon Component
 * Consolidates all custom icon components into a single, reusable component
 * Reduces code duplication from 18 separate icon files
 */

import React from 'react';

export type IconType =
  | 'alertCircle'
  | 'arrowRight'
  | 'bell'
  | 'calendar'
  | 'chevronDown'
  | 'chevronRight'
  | 'chevronUp'
  | 'clipboard'
  | 'edit'
  | 'globe'
  | 'grid'
  | 'groupAdd'
  | 'link'
  | 'plus'
  | 'trash'
  | 'user'
  | 'userPlus'
  | 'users';

interface IconProps {
  type: IconType;
  className?: string;
  size?: number;
}

/**
 * Icon path definitions
 * Each icon type maps to its SVG path elements
 */
const iconPaths: Record<IconType, React.ReactNode> = {
  alertCircle: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4m0 4h.01" />
    </>
  ),
  arrowRight: <path d="M5 12h14M13 18l6-6-6-6" />,
  bell: (
    <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0 1 18 14.158V11a6.002 6.002 0 0 0-4-5.659V5a2 2 0 1 0-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 0 1-6 0v-1m6 0H9" />
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  chevronDown: <path d="M19 9l-7 7-7-7" />,
  chevronRight: <path d="M9 5l7 7-7 7" />,
  chevronUp: <path d="M5 15l7-7 7 7" />,
  clipboard: (
    <>
      <path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2" />
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M9 14l2 2 4-4" />
    </>
  ),
  edit: (
    <>
      <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19.5 3 21l1.5-4L16.5 3.5z" />
      <path d="M12 20h9" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </>
  ),
  groupAdd: (
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h8v-2c0-1.1.9-2 2-2s2 .9 2 2v2h8v-2c0-2.66-5.33-4-8-4zm7-7V3h-2v2h-2v2h2v2h2V7h2V5h-2z" />
  ),
  link: (
    <>
      <path d="M10 14a5 5 0 0 1 0-7l2-2a5 5 0 0 1 7 7l-2 2" />
      <path d="M14 10a5 5 0 0 1 0 7l-2 2a5 5 0 0 1-7-7l2-2" />
    </>
  ),
  plus: <path d="M12 4v16m8-8H4" />,
  trash: <path d="M3 6h18M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" />,
  user: (
    <>
      <circle cx="12" cy="7" r="4" />
      <path d="M5.5 21a8.38 8.38 0 0 1 13 0" />
    </>
  ),
  userPlus: (
    <>
      <circle cx="9" cy="7" r="4" />
      <path d="M17 21v-2a4 4 0 0 0-8 0v2" />
      <path d="M19 8v6m3-3h-6" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="7" r="4" />
      <path d="M17 21v-2a4 4 0 0 0-8 0v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
};

/**
 * Icon component
 * @param type - The icon type to render
 * @param className - Optional CSS classes
 * @param size - Optional size (defaults to 20px via w-5 h-5)
 */
const Icon: React.FC<IconProps> = ({ type, className = 'w-5 h-5', size }) => {
  const sizeClass = size ? `w-${size} h-${size}` : className;
  const fill = type === 'groupAdd' ? 'currentColor' : 'none';
  const stroke = type === 'groupAdd' ? 'none' : 'currentColor';

  return (
    <svg
      className={sizeClass}
      fill={fill}
      stroke={stroke}
      strokeWidth={type === 'groupAdd' ? 0 : 2}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      {iconPaths[type]}
    </svg>
  );
};

export default Icon;
