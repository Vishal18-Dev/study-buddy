'use client';
import React, { createContext, useContext, useEffect } from 'react';

// Dark mode removed — always light
interface ThemeContextType {
  theme: 'light';
}

const ThemeContext = createContext<ThemeContextType>({ theme: 'light' });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Always remove dark class and force light
    const root = window.document.documentElement;
    root.classList.remove('dark');
    localStorage.removeItem('theme');
  }, []);

  return (
    <ThemeContext.Provider value={{ theme: 'light' }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
