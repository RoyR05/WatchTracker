import { useState } from 'react';
import { useProfile } from '../contexts/ProfileContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import { Layout } from '../components/layout/Layout';

const AVATAR_COLORS = [
  '#3B82F6', // blue
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#06B6D4', // cyan
  '#6366F1', // indigo
];

export default function ManageProfilesPage() {
  const { profiles, createProfile, updateProfile, deleteProfile, currentProfile } = useProfile();
  const toast = useToast();
  const navigate = useNavigate();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<any>(null);

  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileColor, setNewProfileColor] = useState(AVATAR_COLORS[0]);

  const handleAddProfile = async () => {
    if (!newProfileName.trim()) {
      toast.error('Please enter a profile name');
      return;
    }

    if (profiles.length >= 4) {
      toast.error('Maximum 4 profiles allowed');
      return;
    }

    try {
      await createProfile(newProfileName.trim(), newProfileColor);
      toast.success('Profile created successfully');
      setShowAddModal(false);
      setNewProfileName('');
      setNewProfileColor(AVATAR_COLORS[0]);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create profile');
    }
  };

  const handleEditProfile = async () => {
    if (!selectedProfile) return;

    if (!newProfileName.trim()) {
      toast.error('Please enter a profile name');
      return;
    }

    try {
      await updateProfile(selectedProfile.id, {
        profile_name: newProfileName.trim(),
        avatar_color: newProfileColor
      });
      toast.success('Profile updated successfully');
      setShowEditModal(false);
      setSelectedProfile(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update profile');
    }
  };

  const handleDeleteProfile = async () => {
    if (!selectedProfile) return;

    try {
      await deleteProfile(selectedProfile.id);
      toast.success('Profile deleted successfully');
      setShowDeleteModal(false);
      setSelectedProfile(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete profile');
    }
  };

  const openEditModal = (profile: any) => {
    setSelectedProfile(profile);
    setNewProfileName(profile.profile_name);
    setNewProfileColor(profile.avatar_color);
    setShowEditModal(true);
  };

  const openDeleteModal = (profile: any) => {
    setSelectedProfile(profile);
    setShowDeleteModal(true);
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Manage Profiles</h1>
            <p className="text-slate-400">Add, edit, or remove profiles</p>
          </div>
          <button
            onClick={() => navigate('/profiles/select')}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            Back to Profiles
          </button>
        </div>

        <div className="grid gap-4 mb-6">
          {profiles.map((profile) => (
            <div
              key={profile.id}
              className="bg-slate-800 rounded-lg p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold"
                  style={{ backgroundColor: profile.avatar_color }}
                >
                  {profile.profile_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-white text-lg font-medium">
                      {profile.profile_name}
                    </h3>
                    {profile.is_primary && (
                      <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded">
                        Primary
                      </span>
                    )}
                    {currentProfile?.id === profile.id && (
                      <span className="text-xs bg-green-500/20 text-green-300 px-2 py-1 rounded">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-slate-400 text-sm">
                    Created {new Date(profile.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => openEditModal(profile)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Edit
                </button>
                {!profile.is_primary && (
                  <button
                    onClick={() => openDeleteModal(profile)}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {profiles.length < 4 && (
          <button
            onClick={() => setShowAddModal(true)}
            className="w-full py-4 border-2 border-dashed border-slate-600 hover:border-slate-500 rounded-lg text-slate-400 hover:text-slate-300 transition-colors"
          >
            + Add New Profile
          </button>
        )}

        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full">
              <h2 className="text-2xl font-bold text-white mb-4">Add New Profile</h2>

              <div className="mb-4">
                <label className="block text-white mb-2">Profile Name</label>
                <input
                  type="text"
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter profile name"
                  maxLength={30}
                />
              </div>

              <div className="mb-6">
                <label className="block text-white mb-2">Avatar Color</label>
                <div className="grid grid-cols-4 gap-3">
                  {AVATAR_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewProfileColor(color)}
                      className={`w-full aspect-square rounded-lg transition-all ${
                        newProfileColor === color
                          ? 'ring-4 ring-white scale-110'
                          : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setNewProfileName('');
                    setNewProfileColor(AVATAR_COLORS[0]);
                  }}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddProfile}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Create Profile
                </button>
              </div>
            </div>
          </div>
        )}

        {showEditModal && selectedProfile && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full">
              <h2 className="text-2xl font-bold text-white mb-4">Edit Profile</h2>

              <div className="mb-4">
                <label className="block text-white mb-2">Profile Name</label>
                <input
                  type="text"
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter profile name"
                  maxLength={30}
                />
              </div>

              <div className="mb-6">
                <label className="block text-white mb-2">Avatar Color</label>
                <div className="grid grid-cols-4 gap-3">
                  {AVATAR_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewProfileColor(color)}
                      className={`w-full aspect-square rounded-lg transition-all ${
                        newProfileColor === color
                          ? 'ring-4 ring-white scale-110'
                          : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedProfile(null);
                  }}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditProfile}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {showDeleteModal && selectedProfile && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full">
              <h2 className="text-2xl font-bold text-white mb-4">Delete Profile</h2>
              <p className="text-slate-300 mb-6">
                Are you sure you want to delete <strong>{selectedProfile.profile_name}</strong>?
                This will permanently remove all watchlist data and progress for this profile.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setSelectedProfile(null);
                  }}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteProfile}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  Delete Profile
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
