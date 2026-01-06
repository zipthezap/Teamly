import React from 'react';


  loading?: boolean;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  startIcon?: React.ReactNode;
  disabled?: boolean;
}

/**
 * Enhanced button component with loading state
 */
  children,
  loading = false,
  disabled,
  startIcon,
  className = '',
  type = 'button',
  ...props
}) => {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center px-5 py-2 rounded-md font-semibold transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed bg-blue-600 text-white hover:bg-blue-700 ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin mr-2 w-4 h-4 text-white" viewBox="0 0 50 50" fill="none"><circle className="opacity-20" cx="25" cy="25" r="20" stroke="currentColor" strokeWidth="6" /><path className="opacity-80" d="M45 25c0-11.046-8.954-20-20-20" stroke="currentColor" strokeWidth="6" strokeLinecap="round" /></svg>
      ) : (
        startIcon && <span className="mr-2">{startIcon}</span>
      )}
      {children}
    </button>
  );
};

export default Button;
