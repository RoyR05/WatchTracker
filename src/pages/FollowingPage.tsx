import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { tmdbService } from '../services/tmdb';
import { followedPeopleService, FollowedPerson } from '../services/followedPeople';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export default function FollowingPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [people, setPeople] = useState<FollowedPerson[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    followedPeopleService.listFollowed().then((p) => {
      setPeople(p);
      setLoading(false);
    });
  }, [user]);

  async function handleUnfollow(personId: number, name: string) {
    const prev = people;
    setPeople((p) => p.filter((x) => x.person_id !== personId));
    const res = await followedPeopleService.unfollow(personId);
    if (!res.success) {
      setPeople(prev);
      toast.error(res.error || 'Failed to unfollow');
    } else {
      toast.success(`Unfollowed ${name}`);
    }
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white">Following</h1>
          <p className="text-gray-400 mt-1 text-sm">
            People you follow. New and upcoming work from them shows up in Discover.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-gray-800 animate-pulse rounded-lg aspect-[2/3]" />
            ))}
          </div>
        ) : people.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-12 text-center">
            <p className="text-white font-medium mb-1">You're not following anyone yet</p>
            <p className="text-gray-400 text-sm mb-4">
              Search for an actor, director, or creator and tap Follow on their page.
            </p>
            <Link
              to="/search"
              className="inline-block px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Search people
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {people.map((p) => (
              <div key={p.id} className="bg-gray-800 rounded-lg overflow-hidden shadow-lg">
                <Link to={`/person/${p.person_id}`} className="group block">
                  <img
                    src={tmdbService.getImageUrl(p.profile_path, 'w342')}
                    alt={p.name}
                    loading="lazy"
                    className="w-full aspect-[2/3] object-cover group-hover:opacity-75 transition-opacity"
                  />
                </Link>
                <div className="p-3">
                  <Link to={`/person/${p.person_id}`}>
                    <h3 className="font-semibold text-white text-sm line-clamp-1 hover:text-primary-400">
                      {p.name}
                    </h3>
                  </Link>
                  {p.known_for_department && (
                    <p className="text-primary-400 text-xs mt-0.5">{p.known_for_department}</p>
                  )}
                  <button
                    onClick={() => handleUnfollow(p.person_id, p.name)}
                    className="mt-2 w-full px-2 py-1 bg-gray-700 hover:bg-red-600 text-gray-300 hover:text-white rounded text-xs font-medium transition-colors"
                  >
                    Unfollow
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
