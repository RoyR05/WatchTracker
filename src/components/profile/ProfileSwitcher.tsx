import { useState, useRef, useEffect } from 'react';
import { useProfile } from '../../contexts/ProfileContext';
import { useNavigate } from 'react-router-dom';

export const ProfileSwitcher = () => {
  const { currentProfile, profiles, switchProfile } = useProfile();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleProfileSwitch = async (profileId: string) => {
    await switchProfile(profileId);
    setIsOpen(false);
    window.location.reload();
  };

  const handleManageProfiles = () => {
    setIsOpen(false);
    navigate('/profiles/manage');
  };

  if (!currentProfile) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors"
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
          style={{ backgroundColor: currentProfile.avatar_color }}
        >
          {currentProfile.profile_name.charAt(0).toUpperCase()}
        </div>
        <span className="hidden md:block text-white text-sm font-medium">
          {currentProfile.profile_name}
        </span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-gray-800 rounded-lg shadow-lg border border-gray-700 py-2 z-50">
          <div className="px-4 py-2 border-b border-gray-700">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Switch Profile</p>
          </div>

          {profiles.map((profile) => (
            <button
              key={profile.id}
              onClick={() => handleProfileSwitch(profile.id)}
              className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-700 transition-colors ${
                currentProfile.id === profile.id ? 'bg-gray-700/50' : ''
              }`}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
                style={{ backgroundColor: profile.avatar_color }}
              >
                {profile.profile_name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 text-left">
                <p className="text-white text-sm font-medium">{profile.profile_name}</p>
                {profile.is_primary && (
                  <p className="text-xs text-blue-300">Primary</p>
                )}
              </div>
              {currentProfile.id === profile.id && (
                <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          ))}

          <div className="border-t border-gray-700 mt-2 pt-2">
            <button
              onClick={handleManageProfiles}
              className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
            >
              Manage Profiles
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
