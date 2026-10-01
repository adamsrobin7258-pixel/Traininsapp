import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { ProfileService } from './profileService';
import type { BodyData, Profile } from './types';

interface ProfileContextValue {
  profile: Profile;
  rename: (displayName: string) => Promise<void>;
  updateBodyData: (data: BodyData) => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

interface ProfileProviderProps {
  service: ProfileService;
  initialProfile: Profile;
  children: ReactNode;
}

export function ProfileProvider({ service, initialProfile, children }: ProfileProviderProps) {
  const [profile, setProfile] = useState(initialProfile);

  const rename = useCallback(
    async (displayName: string) => {
      setProfile(await service.rename(profile, displayName));
    },
    [service, profile],
  );

  const updateBodyData = useCallback(
    async (data: BodyData) => {
      setProfile(await service.updateBodyData(profile, data));
    },
    [service, profile],
  );

  const value = useMemo(
    () => ({ profile, rename, updateBodyData }),
    [profile, rename, updateBodyData],
  );
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  const context = useContext(ProfileContext);
  if (!context) throw new Error('useProfile must be used inside <ProfileProvider>');
  return context;
}
