import { useEffect } from 'react';
import { useTheme } from '../theme/ThemeContext';

export default function LogoColorSync({ logoUrl }) {
  const { updatePaletteFromLogo } = useTheme();

  useEffect(() => {
    if (logoUrl) {
      updatePaletteFromLogo(logoUrl);
    }
  }, [logoUrl]);

  return null;
}
