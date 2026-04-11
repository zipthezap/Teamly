import React from 'react';

interface IconProps {
  className?: string;
}

const CalendarIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
};

export default CalendarIcon;
