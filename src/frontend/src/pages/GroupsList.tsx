
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { groupsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const GroupsList = () => {
  const [groups, setGroups] = useState([]);
  const [filteredGroups, setFilteredGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    fetchGroups();
  }, []);

  const filterGroups = useCallback(() => {
    let filtered = [...groups];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(group =>
        group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        group.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Public/Private filter
    if (filter === 'public') {
      filtered = filtered.filter(group => group.isPublic);
    } else if (filter === 'private') {
      filtered = filtered.filter(group => !group.isPublic);
    } else if (filter === 'admin') {
      filtered = filtered.filter(group =>
        group.members?.some(m => m.userId === user?.id && m.role === 'admin')
      );
    }

    setFilteredGroups(filtered);
  }, [groups, searchTerm, filter, user?.id]);

  useEffect(() => {
    filterGroups();
  }, [filterGroups]);

  const fetchGroups = async () => {
    try {
      const response = await groupsAPI.getAll();
      setGroups(response.data);
    } catch (error) {
      console.error('Error fetching groups:', error);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getUserRole = (group) => {
    const member = group.members?.find(m => m.userId === user?.id);
    return member?.role || 'member';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[80vh]">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto mt-8 mb-8 px-2">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-1">My Groups</h1>
          <div className="text-sm text-[#a1a6b4]">{filteredGroups.length} group{filteredGroups.length !== 1 ? 's' : ''} found</div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/public-groups')} className="border border-blue-600 text-blue-600 hover:bg-blue-900/30 font-medium rounded-md px-3 py-1.5 text-sm transition">Discover Groups</button>
          <button onClick={() => navigate('/groups/new')} className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md px-3 py-1.5 text-sm shadow transition">Create Group</button>
        </div>
      </div>
      {/* Search and Filters */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="relative">
            <input
              type="text"
              className="w-full pl-10 pr-3 py-2 rounded-lg bg-[#232946] text-white border border-[#3a3f4b] focus:outline-none focus:border-blue-500 text-sm"
              placeholder="Search groups..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            <span className="absolute left-3 top-2.5 text-[#a1a6b4]">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {['all', 'public', 'private', 'admin'].map(f => (
            <button
              key={f}
              className={`px-3 py-1.5 rounded-md text-sm font-medium border transition ${filter === f ? 'bg-blue-600 text-white border-blue-600' : 'bg-[#232946] text-[#a1a6b4] border-[#3a3f4b] hover:bg-[#2d3748] hover:text-blue-400'}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' && 'All Groups'}
              {f === 'public' && 'Public'}
              {f === 'private' && 'Private'}
              {f === 'admin' && 'Admin'}
            </button>
          ))}
        </div>
      </div>
      {filteredGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-6">
          <div className="flex flex-col items-center">
            <div className="rounded-full border-4 border-[#a1a6b4] p-4 mb-4">
              <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M8 12h8M12 8v8" /></svg>
            </div>
            <div className="text-xl font-semibold text-[#a1a6b4] mb-1">
              {searchTerm || filter !== 'all' ? 'No groups match your filters' : "You haven't joined any groups yet"}
            </div>
            {!searchTerm && filter === 'all' && (
              <div className="text-[#a1a6b4] mb-4">Start by creating a group to connect and organize events!</div>
            )}
            {!searchTerm && filter === 'all' && (
              <button onClick={() => navigate('/groups/new')} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg px-5 py-2 text-base shadow transition mt-2">Create Your First Group</button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {filteredGroups.map((group) => {
            const role = getUserRole(group);
            const memberCount = group.members?.length || 0;
            const eventCount = group.events?.length || 0;
            const recentMembers = group.members?.slice(0, 4) || [];
            return (
              <div key={group.id} className="relative bg-[#1a202c] rounded-xl shadow-md border border-gray-700 p-5 flex flex-col h-full transition hover:shadow-lg">
                <div className="absolute top-4 right-4 flex gap-1 z-10">
                  {group.isPublic ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-900/50 text-blue-300 border border-blue-700">Public</span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-700 text-gray-300 border border-gray-600">Private</span>
                  )}
                  {role === 'admin' && <span className="ml-2 text-xs bg-blue-700 text-white px-2 py-0.5 rounded border border-blue-800">Admin</span>}
                </div>
                <div className="flex-1 flex flex-col gap-2">
                  <h2 className="text-lg font-bold flex-1 truncate text-gray-100 mb-1">{group.name}</h2>
                  <div className="text-sm text-gray-400 min-h-[48px] line-clamp-3">{group.description || 'No description provided'}</div>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /></svg>
                      {memberCount} member{memberCount !== 1 ? 's' : ''}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" /></svg>
                      {eventCount} event{eventCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {/* Recent members avatars (initials) */}
                  {recentMembers.length > 0 && (
                    <div className="flex -space-x-2 mt-2">
                      {recentMembers.map((member, idx) => (
                        <div key={idx} className="w-8 h-8 rounded-full bg-blue-700 text-white flex items-center justify-center text-xs font-bold border-2 border-white" title={member.user?.name}>
                          {getInitials(member.user?.name)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={() => navigate(`/groups/${group.id}`)} className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg px-4 py-2 text-base shadow transition">View Details</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default GroupsList;
