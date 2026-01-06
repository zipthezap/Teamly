import React, { ReactNode } from 'react';


  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  gradient?: string;
}

/**
 * Reusable empty state component for when there's no data to display
 */
  icon,
  title,
  description,
  actionLabel,
  onAction,
  gradient = 'linear-gradient(135deg, rgba(33, 150, 243, 0.05) 0%, rgba(33, 150, 243, 0.02) 100%)'
}) => {
  return (
    <div
      className="rounded-xl border-2 border-dashed border-white/10 p-10 text-center mx-auto"
      style={{ background: gradient }}
    >
      <div className="inline-flex p-6 rounded-full bg-blue-100 mb-6">{icon}</div>
      <div className="text-2xl font-bold mb-2">{title}</div>
      <div className="text-base text-gray-400 mb-6 max-w-xl mx-auto">{description}</div>
      {actionLabel && onAction && (
        <button
          className="inline-flex items-center justify-center px-8 py-3 rounded-md font-semibold transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 bg-blue-600 text-white hover:bg-blue-700 text-base"
          onClick={onAction}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
