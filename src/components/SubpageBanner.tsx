import React from 'react';

interface SubpageBannerProps {
  subtitle: string;
  chipLabel: string;
  title: string;
  description: string;
  icon?: React.ReactNode;
}

export const SubpageBanner: React.FC<SubpageBannerProps> = ({
  subtitle,
  chipLabel,
  title,
  description,
  icon,
}) => {
  return (
    <div
      className="rounded-b-[40px] sm:rounded-b-[60px] relative overflow-hidden bg-[#f1f4f9] dark:bg-[#1a1f24] border-b border-black/5 dark:border-white/5 py-12 sm:py-16 mb-8"
      style={{
        backgroundImage: `radial-gradient(rgba(202, 0, 25, 0.08) 1px, transparent 1px)`,
        backgroundSize: '28px 28px',
      }}
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center flex flex-col items-center gap-5">
        {/* Signature Floating Pill */}
        <div className="p-1 rounded-full border border-black/10 dark:border-white/30 bg-black/[0.02] dark:bg-black/20 inline-flex items-center gap-3">
          <span className="text-xs font-medium text-neutral-800 dark:text-white ml-3">
            {subtitle}
          </span>
          <span className="bg-[#ca0019] px-3 py-1 rounded-full inline-flex items-center gap-1.5 text-xs font-bold text-white">
            {icon}
            <span>{chipLabel}</span>
          </span>
        </div>

        {/* Centered Headline */}
        <h1 className="text-3xl sm:text-5xl font-semibold leading-tight tracking-tight text-[#1a1a1a] dark:text-white max-w-4xl">
          {title}
        </h1>

        <p className="text-sm sm:text-base text-gray-600 dark:text-neutral-400 max-w-2xl">
          {description}
        </p>

        {/* Exact Signature Crimson Squiggle Wave SVG from theuniques.in */}
        <div className="w-[120px] mt-1">
          <svg viewBox="0 0 122 10" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path
              d="M1 5.5C10 5.5 10 1 20 1C30 1 30 9 40 9C50 9 50 1 60 1C70 1 70 9 80 9C90 9 90 1 100 1C110 1 110 9 121 9"
              stroke="#ca0019"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
    </div>
  );
};
