import React from 'react';

export type StatusType = 'success' | 'error' | 'warning' | 'info' | 'default';

interface StatusBadgeProps {
  status: StatusType;
  label: string;
  className?: string;
}

/**
 * Reusable status badge component with consistent styling using Tailwind
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({ 
  status, 
  label,
  className = ''
}) => {
  const colorClasses: Record<StatusType, string> = {
    success: 'bg-green-100 text-green-700 border-green-200',
    error: 'bg-red-100 text-red-700 border-red-200',
    warning: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    info: 'bg-blue-100 text-blue-700 border-blue-200',
    default: 'bg-gray-100 text-gray-700 border-gray-200'
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${colorClasses[status]} ${className}`}
    >
      {label}
    </span>
  );
};

export default StatusBadge;
