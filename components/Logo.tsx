'use client';

interface LogoProps {
  className?: string;
  variant?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export default function Logo({ className = '', variant = 'light', size = 'md' }: LogoProps) {
  const sizes = {
    sm: { verve: 'text-2xl', advisory: 'text-sm' },
    md: { verve: 'text-4xl', advisory: 'text-lg' },
    lg: { verve: 'text-5xl', advisory: 'text-xl' },
    xl: { verve: 'text-6xl', advisory: 'text-2xl' },
  };

  const colors = {
    light: { verve: 'text-white', advisory: 'text-white/90' },
    dark: { verve: 'text-brand', advisory: 'text-ink-secondary' },
  };

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <h1 className={`${sizes[size].verve} font-black tracking-tight ${colors[variant].verve}`} style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        verve
      </h1>
      <p className={`${sizes[size].advisory} font-semibold ${colors[variant].advisory}`}>
        Advisory
      </p>
    </div>
  );
}
