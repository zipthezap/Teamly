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
    success: 'bg-green-900/50 text-green-300 border-green-700',
    error: 'bg-red-900/50 text-red-300 border-red-700',
    warning: 'bg-yellow-900/50 text-yellow-300 border-yellow-700',
    info: 'bg-blue-900/50 text-blue-300 border-blue-700',
    default: 'bg-gray-700 text-gray-300 border-gray-600'
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
