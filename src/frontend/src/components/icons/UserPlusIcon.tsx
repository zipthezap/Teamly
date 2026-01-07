import React from 'react';

interface IconProps {
  className?: string;
}

const UserPlusIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="9" cy="7" r="4" />
      <path d="M17 21v-2a4 4 0 0 0-8 0v2" />
      <path d="M19 8v6m3-3h-6" />
    </svg>
  );
};

export default UserPlusIcon;
