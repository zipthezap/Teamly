
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { groupsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';

const GroupsList = () => {
  const [groups, setGroups] = useState([]);
  const [filteredGroups, setFilteredGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();

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
          <h1 className="text-2xl font-bold mb-1">{t('groups.myGroups')}</h1>
          <div className="text-sm text-[#a1a6b4]">{t('groups.groupsFound', { count: filteredGroups.length })}</div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/public-groups')} className="border border-blue-600 text-blue-600 hover:bg-blue-900/30 font-medium rounded-md px-3 py-1.5 text-sm transition">{t('groups.discoverGroups')}</button>
          <button onClick={() => navigate('/groups/new')} className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md px-3 py-1.5 text-sm shadow transition">{t('groups.createGroup')}</button>
        </div>
      </div>
      
      {/* Statistics Overview */}
      {groups.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg p-4 shadow-lg">
            <div className="text-3xl font-bold text-white">{groups.length}</div>
            <div className="text-sm text-blue-100 mt-1">{t('groups.allGroups')}</div>
          </div>
          <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-lg p-4 shadow-lg">
            <div className="text-3xl font-bold text-white">{groups.filter(g => g.isPublic).length}</div>
            <div className="text-sm text-green-100 mt-1">{t('groups.public')}</div>
          </div>
          <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg p-4 shadow-lg">
            <div className="text-3xl font-bold text-white">{groups.filter(g => !g.isPublic).length}</div>
            <div className="text-sm text-purple-100 mt-1">{t('groups.private')}</div>
          </div>
          <div className="bg-gradient-to-br from-orange-600 to-orange-700 rounded-lg p-4 shadow-lg">
            <div className="text-3xl font-bold text-white">{groups.filter(g => g.members?.some(m => m.userId === user?.id && m.role === 'admin')).length}</div>
            <div className="text-sm text-orange-100 mt-1">{t('groups.admin')}</div>
          </div>
        </div>
      )}
      
      {/* Search and Filters */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="relative">
            <input
              type="text"
              className="w-full pl-10 pr-3 py-2 rounded-lg bg-[#232946] text-white border border-[#3a3f4b] focus:outline-none focus:border-blue-500 text-sm"
              placeholder={t('groups.searchGroups')}
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
              {f === 'all' && t('groups.allGroups')}
              {f === 'public' && t('groups.public')}
              {f === 'private' && t('groups.private')}
              {f === 'admin' && t('groups.admin')}
            </button>
          ))}
        </div>
      </div>
      {filteredGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-6">
          <div className="flex flex-col items-center">
            <div className="rounded-full bg-gradient-to-br from-blue-600 to-purple-600 p-6 mb-4 shadow-lg">
              <svg width="48" height="48" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
              </svg>
            </div>
            <div className="text-2xl font-bold text-white mb-2">
              {searchTerm || filter !== 'all' ? t('groups.noGroupsMatch') : t('groups.noGroupsYet')}
            </div>
            {!searchTerm && filter === 'all' && (
              <>
                <div className="text-[#a1a6b4] mb-4 text-center max-w-md">{t('groups.createFirstGroupDesc')}</div>
                <button onClick={() => navigate('/groups/new')} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-lg px-6 py-3 text-base shadow-lg transition transform hover:scale-105">{t('groups.createFirstGroup')}</button>
              </>
            )}
            {(searchTerm || filter !== 'all') && (
              <button onClick={() => { setSearchTerm(''); setFilter('all'); }} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg px-5 py-2 text-base shadow transition mt-2">{t('groups.allGroups')}</button>
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
              <div key={group.id} className="relative bg-gradient-to-br from-[#1a202c] to-[#2d3748] rounded-xl shadow-lg border border-gray-700 p-5 flex flex-col h-full transition-all duration-300 hover:shadow-2xl hover:scale-105 hover:border-blue-500">
                <div className="absolute top-4 right-4 flex gap-1 z-10">
                  {group.isPublic ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-900/50 text-blue-300 border border-blue-700">{t('groups.public')}</span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-700 text-gray-300 border border-gray-600">{t('groups.private')}</span>
                  )}
                  {role === 'admin' && <span className="ml-2 text-xs bg-gradient-to-r from-blue-600 to-purple-600 text-white px-2 py-0.5 rounded border border-blue-800">{t('groups.admin')}</span>}
                </div>
                <div className="flex-1 flex flex-col gap-2">
                  <h2 className="text-lg font-bold flex-1 truncate text-gray-100 mb-1">{group.name}</h2>
                  <div className="text-sm text-gray-400 min-h-[48px] line-clamp-3">{group.description || t('groups.noDescriptionProvided')}</div>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
                      </svg>
                      {t('groups.membersCount', { count: memberCount })}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                      {t('groups.eventsCount', { count: eventCount })}
                    </span>
                  </div>
                  {/* Recent members avatars (initials) */}
                  {recentMembers.length > 0 && (
                    <div className="flex -space-x-2 mt-2">
                      {recentMembers.map((member, idx) => (
                        <div key={idx} className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 text-white flex items-center justify-center text-xs font-bold border-2 border-white shadow-md" title={member.user?.name}>
                          {getInitials(member.user?.name)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={() => navigate(`/groups/${group.id}`)} className="mt-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-lg px-4 py-2 text-base shadow-lg transition transform hover:scale-105">{t('common.viewDetails')}</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default GroupsList;
