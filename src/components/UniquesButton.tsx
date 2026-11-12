import React from 'react';
import { ArrowUpRight } from 'lucide-react';

interface UniquesButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  bgColor?: string;
  color?: string;
  iconColor?: string;
  className?: string;
  type?: 'button' | 'submit';
  title?: string;
}

export const UniquesButton: React.FC<UniquesButtonProps> = ({
  children,
  onClick,
  disabled = false,
  bgColor = '#ca0019',
  color = '#ffffff',
  iconColor = '#000000',
  className = '',
  type = 'button',
  title,
}) => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        backgroundColor: disabled ? '#cbd5e1' : bgColor,
        color: disabled ? '#64748b' : color,
      }}
      className={`rounded-full min-w-44 relative pl-5 pr-2 py-2 overflow-hidden group transition-all ease-out duration-300 inline-flex items-center justify-between gap-3 ${
        disabled
          ? 'cursor-not-allowed opacity-70'
          : 'hover:ring-2 hover:ring-[#ca0019] hover:ring-offset-2 dark:hover:ring-offset-[#0a0a0a] cursor-pointer active:scale-[0.98]'
      } ${className}`}
    >
      {!disabled && (
        <span className="absolute right-0 w-8 h-32 -mt-12 transition-all duration-1000 transform translate-x-12 bg-white opacity-20 rotate-12 group-hover:-translate-x-48 ease pointer-events-none" />
      )}
      <div className="flex-1 text-center font-medium text-sm sm:text-base whitespace-nowrap">
        {children}
      </div>
      <div className="shrink-0 ml-auto">
        <span
          style={{ backgroundColor: disabled ? '#e2e8f0' : color }}
          className="w-8 h-8 rounded-full flex justify-center items-center shadow-xs"
        >
          <ArrowUpRight
            className="w-4 h-4 transition-transform duration-150 group-hover:rotate-45"
            style={{ color: disabled ? '#64748b' : iconColor }}
          />
        </span>
      </div>
    </button>
  );
};
