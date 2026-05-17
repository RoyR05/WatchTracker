import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { tmdbService, PersonDetails, PersonCredits, MovieCredit, TVCredit } from '../services/tmdb';
import { followedPeopleService } from '../services/followedPeople';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export function PersonPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();
  const [person, setPerson] = useState<PersonDetails | null>(null);
  const [credits, setCredits] = useState<PersonCredits | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'movies' | 'tv'>('movies');
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  useEffect(() => {
    if (!id) return;

    const fetchPersonData = async () => {
      try {
        setLoading(true);
        const [personData, creditsData] = await Promise.all([
          tmdbService.getPersonDetails(parseInt(id)),
          tmdbService.getPersonCombinedCredits(parseInt(id))
        ]);

        setPerson(personData);
        setCredits(creditsData);
      } catch (error) {
        console.error('Error fetching person data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPersonData();
  }, [id]);

  useEffect(() => {
    if (!id || !user) return;
    followedPeopleService.isFollowing(parseInt(id)).then(setFollowing);
  }, [id, user]);

  async function toggleFollow() {
    if (!id || !person) return;
    if (!user) {
      toast.error('Please sign in to follow people');
      return;
    }
    setFollowBusy(true);
    const next = !following;
    setFollowing(next); // optimistic
    const res = next
      ? await followedPeopleService.follow({
          person_id: person.id,
          name: person.name,
          profile_path: person.profile_path,
          known_for_department: person.known_for_department,
        })
      : await followedPeopleService.unfollow(person.id);
    if (!res.success) {
      setFollowing(!next); // revert
      toast.error(res.error || 'Failed to update follow');
    } else {
      toast.success(next ? `Following ${person.name}` : `Unfollowed ${person.name}`);
    }
    setFollowBusy(false);
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </Layout>
    );
  }

  if (!person || !credits) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-gray-400">Person not found</p>
        </div>
      </Layout>
    );
  }

  const movieCredits = credits.cast.filter((credit): credit is MovieCredit => 'title' in credit)
    .sort((a, b) => {
      const dateA = a.release_date ? new Date(a.release_date).getTime() : 0;
      const dateB = b.release_date ? new Date(b.release_date).getTime() : 0;
      return dateB - dateA;
    });

  const tvCredits = credits.cast.filter((credit): credit is TVCredit => 'name' in credit)
    .sort((a, b) => {
      const dateA = a.first_air_date ? new Date(a.first_air_date).getTime() : 0;
      const dateB = b.first_air_date ? new Date(b.first_air_date).getTime() : 0;
      return dateB - dateA;
    });

  const age = person.birthday ? Math.floor((new Date().getTime() - new Date(person.birthday).getTime()) / (1000 * 60 * 60 * 24 * 365.25)) : null;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row gap-8">
          <div className="md:w-1/3">
            <img
              src={tmdbService.getImageUrl(person.profile_path, 'w500')}
              alt={person.name}
              className="w-full rounded-lg shadow-2xl sticky top-4"
            />
          </div>

          <div className="md:w-2/3">
            <div className="flex flex-wrap items-center gap-4 mb-4">
              <h1 className="text-4xl font-bold text-white">{person.name}</h1>
              <button
                onClick={toggleFollow}
                disabled={followBusy}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${
                  following
                    ? 'bg-gray-700 text-white hover:bg-gray-600'
                    : 'bg-primary-600 text-white hover:bg-primary-700'
                }`}
              >
                {following ? '✓ Following' : '+ Follow'}
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-white mb-3">Personal Info</h2>
                <div className="space-y-2 text-gray-300">
                  <div>
                    <span className="font-semibold text-white">Known For:</span>
                    <span className="ml-2">{person.known_for_department}</span>
                  </div>
                  {person.birthday && (
                    <div>
                      <span className="font-semibold text-white">Birthday:</span>
                      <span className="ml-2">
                        {new Date(person.birthday).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                        {age && ` (${age} years old)`}
                      </span>
                    </div>
                  )}
                  {person.deathday && (
                    <div>
                      <span className="font-semibold text-white">Died:</span>
                      <span className="ml-2">
                        {new Date(person.deathday).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                  )}
                  {person.place_of_birth && (
                    <div>
                      <span className="font-semibold text-white">Place of Birth:</span>
                      <span className="ml-2">{person.place_of_birth}</span>
                    </div>
                  )}
                  {person.also_known_as.length > 0 && (
                    <div>
                      <span className="font-semibold text-white">Also Known As:</span>
                      <div className="ml-2 mt-1">
                        {person.also_known_as.map((name, index) => (
                          <div key={index} className="text-sm">{name}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {person.biography && (
                <div>
                  <h2 className="text-xl font-semibold text-white mb-3">Biography</h2>
                  <p className="text-gray-300 whitespace-pre-line leading-relaxed">
                    {person.biography}
                  </p>
                </div>
              )}

              <div>
                <h2 className="text-xl font-semibold text-white mb-4">Known For</h2>

                <div className="flex gap-4 mb-4 border-b border-gray-700">
                  <button
                    onClick={() => setActiveTab('movies')}
                    className={`px-4 py-2 font-medium transition-colors ${
                      activeTab === 'movies'
                        ? 'text-blue-500 border-b-2 border-blue-500'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Movies ({movieCredits.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('tv')}
                    className={`px-4 py-2 font-medium transition-colors ${
                      activeTab === 'tv'
                        ? 'text-blue-500 border-b-2 border-blue-500'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    TV Shows ({tvCredits.length})
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {activeTab === 'movies' && movieCredits.map((movie) => (
                    <Link
                      key={movie.id}
                      to={`/details/movie/${movie.id}`}
                      className="group"
                    >
                      <div className="bg-gray-800 rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-shadow">
                        <img
                          src={tmdbService.getImageUrl(movie.poster_path, 'w500')}
                          alt={movie.title}
                          className="w-full aspect-[2/3] object-cover group-hover:opacity-75 transition-opacity"
                        />
                        <div className="p-3">
                          <h3 className="font-semibold text-white text-sm line-clamp-2 mb-1">
                            {movie.title}
                          </h3>
                          {movie.character && (
                            <p className="text-gray-400 text-xs line-clamp-2">
                              as {movie.character}
                            </p>
                          )}
                          {movie.release_date && (
                            <p className="text-gray-500 text-xs mt-1">
                              {new Date(movie.release_date).getFullYear()}
                            </p>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}

                  {activeTab === 'tv' && tvCredits.map((show) => (
                    <Link
                      key={show.id}
                      to={`/details/tv/${show.id}`}
                      className="group"
                    >
                      <div className="bg-gray-800 rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-shadow">
                        <img
                          src={tmdbService.getImageUrl(show.poster_path, 'w500')}
                          alt={show.name}
                          className="w-full aspect-[2/3] object-cover group-hover:opacity-75 transition-opacity"
                        />
                        <div className="p-3">
                          <h3 className="font-semibold text-white text-sm line-clamp-2 mb-1">
                            {show.name}
                          </h3>
                          {show.character && (
                            <p className="text-gray-400 text-xs line-clamp-2">
                              as {show.character}
                            </p>
                          )}
                          {show.first_air_date && (
                            <p className="text-gray-500 text-xs mt-1">
                              {new Date(show.first_air_date).getFullYear()}
                            </p>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
