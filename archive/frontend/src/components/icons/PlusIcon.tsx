import React from 'react';

interface IconProps {
  className?: string;
}

const PlusIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M12 4v16m8-8H4" />
    </svg>
  );
};

export default PlusIcon;
