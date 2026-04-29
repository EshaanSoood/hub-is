import { useCallback, useEffect, useMemo, useState } from 'react';

const PROFILE_IMAGE_STORAGE_PREFIX = 'hub:profile-image:';

const readStoredProfileImage = (storageKey: string): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.localStorage.getItem(storageKey);
  } catch {
    return null;
  }
};

const writeStoredProfileImage = (storageKey: string, imageUrl: string): void => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(storageKey, imageUrl);
  } catch {
    // Keep the preview usable even when local persistence is unavailable.
  }
};

export const useLocalProfileImage = (userId: string) => {
  const storageKey = useMemo(() => `${PROFILE_IMAGE_STORAGE_PREFIX}${userId || 'anonymous'}`, [userId]);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(() => readStoredProfileImage(storageKey));

  useEffect(() => {
    setProfileImageUrl(readStoredProfileImage(storageKey));
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }
    const handleStorage = (event: StorageEvent) => {
      if (event.key === storageKey) {
        setProfileImageUrl(event.newValue);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [storageKey]);

  const saveProfileImageUrl = useCallback((imageUrl: string) => {
    writeStoredProfileImage(storageKey, imageUrl);
    setProfileImageUrl(imageUrl);
  }, [storageKey]);

  return {
    profileImageUrl,
    saveProfileImageUrl,
  };
};
