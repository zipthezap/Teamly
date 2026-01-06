import React from 'react';
// Removed MUI imports; using Tailwind and SVG

interface LoadingSpinnerProps {
  message?: string;
  size?: number;
}

/**
 * Reusable loading spinner component
 */
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  message = 'Loading...', 
  size = 60 
}) => {
  return (
    <div className="flex flex-col justify-center items-center min-h-[80vh] gap-4">
      <svg
        className="animate-spin text-blue-500"
        width={size}
        height={size}
        viewBox="0 0 50 50"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          className="opacity-20"
          cx="25"
          cy="25"
          r="20"
          stroke="currentColor"
          strokeWidth="6"
        />
        <path
          className="opacity-80"
          d="M45 25c0-11.046-8.954-20-20-20"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
        />
      </svg>
      {message && (
        <div className="text-base text-gray-400">{message}</div>
      )}
    </div>
  );
};

export default LoadingSpinner;
