import { useProfile } from '../../contexts/ProfileContext';
import { useNavigate } from 'react-router-dom';

export const ProfileSelector = () => {
  const { profiles, switchProfile, loading } = useProfile();
  const navigate = useNavigate();

  const handleProfileSelect = async (profileId: string) => {
    await switchProfile(profileId);
    navigate('/');
  };

  const handleManageProfiles = () => {
    navigate('/profiles/manage');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading profiles...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <h1 className="text-4xl md:text-5xl font-bold text-white text-center mb-4">
          Who's Watching?
        </h1>
        <p className="text-slate-300 text-center mb-12">
          Select your profile to continue
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
          {profiles.map((profile) => (
            <button
              key={profile.id}
              onClick={() => handleProfileSelect(profile.id)}
              className="flex flex-col items-center gap-3 p-4 rounded-lg hover:bg-white/10 transition-all duration-200 group"
            >
              <div
                className="w-24 h-24 md:w-32 md:h-32 rounded-full flex items-center justify-center text-white text-3xl md:text-4xl font-bold transition-transform duration-200 group-hover:scale-110 ring-4 ring-transparent group-hover:ring-white/30"
                style={{ backgroundColor: profile.avatar_color }}
              >
                {profile.profile_name.charAt(0).toUpperCase()}
              </div>
              <span className="text-white text-lg font-medium">
                {profile.profile_name}
              </span>
              {profile.is_primary && (
                <span className="text-xs text-blue-300 bg-blue-500/20 px-2 py-1 rounded">
                  Primary
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex justify-center">
          <button
            onClick={handleManageProfiles}
            className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors duration-200 border border-white/20"
          >
            Manage Profiles
          </button>
        </div>
      </div>
    </div>
  );
};
