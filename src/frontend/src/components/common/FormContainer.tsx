import React, { ReactNode } from 'react';

interface FormContainerProps {
  children: ReactNode;
  maxWidth?: string | number;
  className?: string;
}

/**
 * Reusable container for form pages with consistent styling
 */
export const FormContainer: React.FC<FormContainerProps> = ({
  children,
  maxWidth = '28rem',
  className = '',
}) => {
  return (
    <div className={`mx-auto mt-16 w-full`} style={{ maxWidth }}>
      <div className={`bg-white dark:bg-[#1a2233] rounded-xl shadow-md p-8 ${className}`}>
        <div className="flex flex-col items-center">
          {children}
        </div>
      </div>
    </div>
  );
};
