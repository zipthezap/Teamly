import React from 'react';

interface IconProps {
  className?: string;
}

const GlobeIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h2m16 0h2M12 2v2m0 16v2m7.07-7.07l-1.42-1.42M4.93 19.07l-1.42-1.42M19.07 4.93l-1.42 1.42M4.93 4.93l1.42 1.42" />
    </svg>
  );
};

export default GlobeIcon;
