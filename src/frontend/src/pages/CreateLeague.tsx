import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { leaguesAPI } from '../services/api';
import { CreateLeagueData } from '../../../shared/types/league.types';

const CreateLeague: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<CreateLeagueData>({
    title: '',
    groupId: '',
    sport: 'football',
    startDate: '',
    isPublic: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await leaguesAPI.create(formData);
      navigate(`/leagues/${response.data.id}`);
    } catch {
      setError('Failed to create league');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Create League</h1>
      {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Title *</label>
          <input name="title" value={formData.title} onChange={handleChange} required className="w-full border rounded px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Group ID *</label>
          <input name="groupId" value={formData.groupId} onChange={handleChange} required className="w-full border rounded px-3 py-2" placeholder="Enter group ID" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Sport *</label>
          <select name="sport" value={formData.sport} onChange={handleChange} className="w-full border rounded px-3 py-2">
            <option value="football">Football</option>
            <option value="basketball">Basketball</option>
            <option value="tennis">Tennis</option>
            <option value="volleyball">Volleyball</option>
            <option value="running">Running</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea name="description" onChange={handleChange} className="w-full border rounded px-3 py-2" rows={3} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Start Date *</label>
          <input name="startDate" type="date" value={formData.startDate} onChange={handleChange} required className="w-full border rounded px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">End Date</label>
          <input name="endDate" type="date" onChange={handleChange} className="w-full border rounded px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Max Teams</label>
          <input name="maxTeams" type="number" onChange={handleChange} className="w-full border rounded px-3 py-2" min="2" />
        </div>
        <div className="flex items-center gap-2">
          <input name="isPublic" type="checkbox" checked={formData.isPublic} onChange={handleChange} className="rounded" />
          <label className="text-sm font-medium">Public League</label>
        </div>
        <div className="flex gap-3 pt-4">
          <button type="submit" disabled={submitting} className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600 disabled:opacity-50">
            {submitting ? 'Creating...' : 'Create League'}
          </button>
          <button type="button" onClick={() => navigate('/leagues')} className="border px-6 py-2 rounded hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateLeague;
