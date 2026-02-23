import React, { createContext, useContext, useState } from 'react';

interface ProfileContextType {
  currentProfile: any | null;
  setCurrentProfile: (profile: any) => void;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [currentProfile, setCurrentProfile] = useState<any>(null);

  return (
    <ProfileContext.Provider value={{ currentProfile, setCurrentProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within ProfileProvider');
  }
  return context;
}
