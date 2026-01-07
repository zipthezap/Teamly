import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

const Input: React.FC<InputProps> = ({ className = "", ...props }) => (
  <input
    className={`rounded bg-slate-600 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
    {...props}
  />
);

export default Input;
