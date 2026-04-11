import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { leaguesAPI } from '../services/api';
import { League } from '../../../shared/types/league.types';

const LeaguesList: React.FC = () => {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    leaguesAPI.getAll()
      .then(r => setLeagues(r.data))
      .catch(() => setError('Failed to load leagues'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-4">Loading leagues...</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Leagues</h1>
        <Link to="/leagues/new" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
          Create League
        </Link>
      </div>
      {leagues.length === 0 ? (
        <p className="text-gray-500">No leagues found.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {leagues.map(league => (
            <Link key={league.id} to={`/leagues/${league.id}`} className="block border rounded-lg p-4 hover:shadow-md transition-shadow">
              <h2 className="text-lg font-semibold">{league.title}</h2>
              {league.description && <p className="text-gray-600 text-sm mt-1">{league.description}</p>}
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">{league.sport}</span>
                <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded capitalize">{league.status}</span>
                {league.isPremium && <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Premium</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default LeaguesList;
