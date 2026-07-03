import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [palette, setPalette] = useState({
    primary: '#0f172a',
    secondary: '#64748b',
    accent: '#1d4ed8',
    background: '#fff',
    text: '#0f172a',
  });

  useEffect(() => {
    Object.entries(palette).forEach(([key, value]) => {
      document.documentElement.style.setProperty(`--${key}`, value);
    });
  }, [palette]);

  const defaultPalette = {
    primary: '#0f172a',
    secondary: '#64748b',
    accent: '#1d4ed8',
    background: '#fff',
    text: '#0f172a',
  };

  const updatePaletteFromLogo = async (logoUrl) => {
    try {
      const { extractPaletteFromImage } = await import('./extractPaletteFromImage');
      const paletteArr = await extractPaletteFromImage(logoUrl, 5);
      if (!paletteArr || paletteArr.length < 3) throw new Error('Palette extraction failed');
      setPalette({
        primary: paletteArr[0] || defaultPalette.primary,
        secondary: paletteArr[1] || defaultPalette.secondary,
        accent: paletteArr[2] || defaultPalette.accent,
        background: paletteArr[3] || defaultPalette.background,
        text: paletteArr[4] || defaultPalette.text,
      });
    } catch (e) {
      // fallback: use default palette
      setPalette(defaultPalette);
      if (typeof window !== 'undefined' && window.console) {
        console.warn('Theme color extraction failed, using default palette.', e);
      }
    }
  };

  return (
    <ThemeContext.Provider value={{ palette, setPalette, updatePaletteFromLogo }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
