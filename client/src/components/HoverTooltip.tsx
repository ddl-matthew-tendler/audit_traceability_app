import { useState, useCallback } from 'react';

interface HoverTooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  /** Optional className for the wrapper */
  className?: string;
}

/** Tooltip that appears on hover with detailed information */
export function HoverTooltip({ content, children, className = '' }: HoverTooltipProps) {
  const [visible, setVisible] = useState(false);

  const handleMouseEnter = useCallback(() => setVisible(true), []);
  const handleMouseLeave = useCallback(() => setVisible(false), []);

  return (
    <div
      className={`relative inline-block ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {visible && (
        <div
          role="tooltip"
          className="absolute bottom-full left-1/2 z-[9999] mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-[#E0E0E0] bg-white px-3 py-2.5 shadow-lg"
        >
          <div className="text-sm text-[#3F4547]">{content}</div>
        </div>
      )}
    </div>
  );
}
