import React from 'react';

interface IconProps {
  className?: string;
}

const EditIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19.5 3 21l1.5-4L16.5 3.5z" />
      <path d="M12 20h9" />
    </svg>
  );
};

export default EditIcon;
