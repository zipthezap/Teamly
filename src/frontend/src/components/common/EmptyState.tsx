import React, { ReactNode } from 'react';

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: string; // for future styling (optional)
}

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actions?: EmptyStateAction[];
  gradient?: string;
}

/**
 * Reusable empty state component for when there's no data to display
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actions = [],
  gradient = 'linear-gradient(135deg, rgba(33, 150, 243, 0.05) 0%, rgba(33, 150, 243, 0.02) 100%)'
}) => {
  return (
    <div
      className="rounded-xl border-2 border-dashed border-gray-600 p-10 text-center mx-auto"
      style={{ background: gradient }}
    >
      <div className="inline-flex p-6 rounded-full bg-blue-900/50 mb-6 text-blue-400">
        {icon}
      </div>
      <div className="text-2xl font-bold mb-2 text-gray-100">{title}</div>
      <div className="text-base text-gray-400 mb-6 max-w-xl mx-auto">{description}</div>
      {actions.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {actions.map((action, idx) => (
            <button
              key={idx}
              className="inline-flex items-center justify-center px-8 py-3 rounded-md font-semibold transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 bg-blue-600 text-white hover:bg-blue-700 text-base"
              onClick={action.onClick}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmptyState;
