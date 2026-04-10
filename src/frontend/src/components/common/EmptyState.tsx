import React from 'react';
import { useTheme, alpha } from '@mui/material/styles';

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
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <div
      className="rounded-xl border-2 border-dashed p-10 text-center mx-auto"
      style={{
        background: gradient,
        borderColor: alpha(theme.palette.text.primary, isDark ? 0.25 : 0.16),
      }}
    >
      <div
        className="inline-flex p-6 rounded-full mb-6"
        style={{
          background: alpha(theme.palette.primary.main, isDark ? 0.2 : 0.12),
          color: theme.palette.primary.main,
        }}
      >
        {icon}
      </div>
      <div className="text-2xl font-bold mb-2" style={{ color: theme.palette.text.primary }}>{title}</div>
      <div className="text-base mb-6 max-w-xl mx-auto" style={{ color: theme.palette.text.secondary }}>{description}</div>
      {actions.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {actions.map((action) => (
            <button
              key={action.label}
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
