import React from 'react';

interface IconProps {
  className?: string;
}

const ArrowRightIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M5 12h14M13 18l6-6-6-6" />
    </svg>
  );
};

export default ArrowRightIcon;
