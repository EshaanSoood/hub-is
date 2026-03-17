import { useCallback, useState } from 'react';

export const useLiveRegion = () => {
  const [announcement, setAnnouncement] = useState('');

  const announce = useCallback((message: string) => {
    setAnnouncement('');
    window.requestAnimationFrame(() => {
      setAnnouncement(message);
    });
  }, []);

  return { announcement, announce };
};
