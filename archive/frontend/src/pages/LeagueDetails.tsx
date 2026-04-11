import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { leaguesAPI } from '../services/api';
import { LeagueWithDetails, LeagueStanding, LeagueTeam } from '../../../shared/types/league.types';

const LeagueDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [league, setLeague] = useState<LeagueWithDetails | null>(null);
  const [standings, setStandings] = useState<(LeagueStanding & { team: LeagueTeam })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      leaguesAPI.getById(id),
      leaguesAPI.getStandings(id),
    ])
      .then(([leagueRes, standingsRes]) => {
        setLeague(leagueRes.data);
        setStandings(standingsRes.data);
      })
      .catch(() => setError('Failed to load league'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;
  if (!league) return <div className="p-4">League not found</div>;

  return (
    <div className="container mx-auto p-4">
      <div className="mb-4">
        <Link to="/leagues" className="text-blue-500 hover:underline">← Back to Leagues</Link>
      </div>
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">{league.title}</h1>
            {league.description && <p className="text-gray-600 mt-2">{league.description}</p>}
          </div>
          <div className="flex gap-2">
            <span className="text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded capitalize">{league.sport}</span>
            <span className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded capitalize">{league.status}</span>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {league.city && <div><span className="font-medium">City:</span> {league.city}</div>}
          {league.maxTeams && <div><span className="font-medium">Max Teams:</span> {league.maxTeams}</div>}
          <div><span className="font-medium">Start:</span> {new Date(league.startDate).toLocaleDateString()}</div>
          {league.endDate && <div><span className="font-medium">End:</span> {new Date(league.endDate).toLocaleDateString()}</div>}
        </div>
      </div>

      {standings.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Standings</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4">Team</th>
                  <th className="text-center py-2 px-2">P</th>
                  <th className="text-center py-2 px-2">W</th>
                  <th className="text-center py-2 px-2">D</th>
                  <th className="text-center py-2 px-2">L</th>
                  <th className="text-center py-2 px-2">GF</th>
                  <th className="text-center py-2 px-2">GA</th>
                  <th className="text-center py-2 px-2 font-bold">Pts</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((s, idx) => (
                  <tr key={s.id} className={idx % 2 === 0 ? 'bg-gray-50' : ''}>
                    <td className="py-2 pr-4">{s.team.name}</td>
                    <td className="text-center py-2 px-2">{s.played}</td>
                    <td className="text-center py-2 px-2">{s.won}</td>
                    <td className="text-center py-2 px-2">{s.drawn}</td>
                    <td className="text-center py-2 px-2">{s.lost}</td>
                    <td className="text-center py-2 px-2">{s.goalsFor}</td>
                    <td className="text-center py-2 px-2">{s.goalsAgainst}</td>
                    <td className="text-center py-2 px-2 font-bold">{s.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeagueDetails;
