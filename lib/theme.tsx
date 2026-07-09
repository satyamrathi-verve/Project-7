'use client';

import { createContext, useContext, type ReactNode } from 'react';

type Theme = 'dark';

const ThemeContext = createContext<{ theme: Theme } | null>(null);

/** Runs before paint (via next/script beforeInteractive in layout.tsx). App is dark-mode only. */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

export function ThemeProvider({ children }: { children: ReactNode }) {
  return <ThemeContext.Provider value={{ theme: 'dark' }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
