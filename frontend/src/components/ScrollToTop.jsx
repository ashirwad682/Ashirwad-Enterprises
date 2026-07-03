import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Prevent the browser from restoring scroll position after a page refresh.
if (typeof window !== 'undefined') {
  window.history.scrollRestoration = 'manual';
}

export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);

  return null;
}
