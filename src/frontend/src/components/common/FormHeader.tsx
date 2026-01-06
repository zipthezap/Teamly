import React, { ReactNode } from 'react';

interface FormHeaderProps {
  icon?: ReactNode;
  title: string;
  iconColor?: string;
  iconSize?: string;
}

/**
 * Reusable form header with optional icon and title
 */
export const FormHeader: React.FC<FormHeaderProps> = ({ 
  icon, 
  title,
  iconColor = 'text-blue-600',
  iconSize = 'text-5xl'
}) => {
  return (
    <>
      {icon && (
        <div className={`${iconColor} ${iconSize} mb-4`}>
          {icon}
        </div>
      )}
      <h1 className="text-3xl font-semibold mb-4">
        {title}
      </h1>
    </>
  );
};
