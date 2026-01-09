import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  color?: "primary" | "secondary" | "success" | "danger" | "info";
  size?: "sm" | "md" | "xs";
  className?: string;
}

const colorMap = {
  primary: "bg-blue-600 hover:bg-blue-700 text-white",
  secondary: "bg-slate-600 hover:bg-slate-500 text-white",
  success: "bg-green-600 hover:bg-green-700 text-white",
  danger: "bg-red-500 hover:bg-red-600 text-white",
  info: "bg-cyan-600 hover:bg-cyan-700 text-white",
};

const sizeMap = {
  xs: "px-2 py-0.5 text-xs",
  sm: "px-3 py-1 text-sm",
  md: "px-4 py-2 text-base",
};

const Button: React.FC<ButtonProps> = ({ color = "primary", size = "md", className = "", ...props }) => (
  <button
    className={`rounded shadow transition ${colorMap[color]} ${sizeMap[size]} ${className}`}
    {...props}
  />
);

export default Button;
