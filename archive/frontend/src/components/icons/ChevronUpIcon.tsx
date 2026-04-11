import React from 'react';

interface IconProps {
  className?: string;
}

const ChevronUpIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M5 15l7-7 7 7" />
    </svg>
  );
};

export default ChevronUpIcon;
