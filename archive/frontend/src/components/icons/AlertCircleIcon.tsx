import React from 'react';

interface IconProps {
  className?: string;
}

const AlertCircleIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4m0 4h.01" />
    </svg>
  );
};

export default AlertCircleIcon;
