import React from 'react';

interface FAIconProps extends React.HTMLAttributes<HTMLElement> {
  icon: string; // e.g. "fa-solid fa-wand-magic-sparkles", "fa-solid fa-sliders", "fa-brands fa-linkedin"
  className?: string;
  style?: React.CSSProperties;
}

export const FAIcon: React.FC<FAIconProps> = ({ icon, className = '', style, ...props }) => {
  // Ensure the icon string has fa-solid / fa-brands prefix if only icon name was passed
  const fullIconClass = icon.startsWith('fa-') ? icon : `fa-solid fa-${icon}`;

  return (
    <i
      className={`${fullIconClass} ${className}`}
      style={style}
      aria-hidden="true"
      {...props}
    />
  );
};
