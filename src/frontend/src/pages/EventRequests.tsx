import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { eventRequestsAPI, groupsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const EVENT_TYPES = [
  'football',
  'basketball',
  'tennis',
  'volleyball',
  'badminton',
  'cricket',
  'rugby',
  'hockey',
  'baseball',
  'other',
];

const EventRequests = () => {
  const { groupId } = useParams();
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState({});
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [newRequest, setNewRequest] = useState({
    title: '',
    description: '',
    eventType: 'football',
    location: '',
    startTime: '',
    endTime: '',
    maxPlayers: '',
  });

  useEffect(() => {
    if (groupId) {
      fetchData();
    }
  }, [groupId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [requestsRes, groupRes] = await Promise.all([
        eventRequestsAPI.getByGroup(groupId),
        groupsAPI.getById(groupId),
      ]);
      setRequests(requestsRes.data);
      setGroup(groupRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.error || 'Failed to load event requests',
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (requestId, vote) => {
    setVoting((prev) => ({ ...prev, [requestId]: true }));
    try {
      await eventRequestsAPI.vote(requestId, vote);
      await fetchData();
      setSnackbar({
        open: true,
        message: 'Vote recorded successfully',
        severity: 'success',
      });
    } catch (error) {
      console.error('Error voting:', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.error || 'Failed to record vote',
        severity: 'error',
      });
    } finally {
      setVoting((prev) => ({ ...prev, [requestId]: false }));
    }
  };

  const handleFinalize = async (requestId) => {
    try {
      await eventRequestsAPI.finalize(requestId);
      await fetchData();
      setSnackbar({
        open: true,
        message: 'Event request finalized successfully',
        severity: 'success',
      });
    } catch (error) {
      console.error('Error finalizing:', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.error || 'Failed to finalize request',
        severity: 'error',
      });
    }
  };

  const handleCancel = async (requestId) => {
    try {
      await eventRequestsAPI.cancel(requestId);
      await fetchData();
      setSnackbar({
        open: true,
        message: 'Event request cancelled',
        severity: 'success',
      });
    } catch (error) {
      console.error('Error cancelling:', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.error || 'Failed to cancel request',
        severity: 'error',
      });
    }
  };

  const handleCreateRequest = async () => {
    try {
      await eventRequestsAPI.create({
        ...newRequest,
        groupId,
      });
      await fetchData();
      setCreateDialogOpen(false);
      setNewRequest({
        title: '',
        description: '',
        eventType: 'football',
        location: '',
        startTime: '',
        endTime: '',
        maxPlayers: '',
      });
      setSnackbar({
        open: true,
        message: 'Event request created successfully',
        severity: 'success',
      });
    } catch (error) {
      console.error('Error creating request:', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.error || 'Failed to create event request',
        severity: 'error',
      });
    }
  };

  const isAdmin = group?.members?.some(
    (m) => m.userId === user?.id && m.role === 'admin'
  );

  const getVotePercentage = (request) => {
    const total = request.yesVotes + request.noVotes;
    if (total === 0) return 0;
    return (request.yesVotes / total) * 100;
  };

  const getUserVote = (request) => {
    return request.votes?.find((v) => v.userId === user?.id)?.vote;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[80vh]">
        <svg className="animate-spin text-blue-500" width={48} height={48} viewBox="0 0 50 50" fill="none"><circle className="opacity-20" cx="25" cy="25" r="20" stroke="currentColor" strokeWidth="6" /><path className="opacity-80" d="M45 25c0-11.046-8.954-20-20-20" stroke="currentColor" strokeWidth="6" strokeLinecap="round" /></svg>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto mt-8 mb-8 px-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <div className="text-2xl font-bold mb-1">Event Requests</div>
          {group && (
            <div className="text-sm text-gray-400">{group.name}</div>
          )}
        </div>
        {isAdmin && (
          <button
            className="inline-flex items-center gap-2 px-4 py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 transition text-sm"
            onClick={() => setCreateDialogOpen(true)}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 8v8M8 12h8" /></svg>
            Create Event Request
          </button>
        )}
      </div>

      {requests.length === 0 ? (
        <div className="text-center py-16">
          <svg className="mx-auto mb-4 w-16 h-16 text-gray-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 17v-6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6" /><path d="M12 19v2" /><circle cx="12" cy="12" r="10" /></svg>
          <div className="text-lg text-gray-400 font-semibold mb-2">No event requests yet</div>
          <div className="text-sm text-gray-400">
            {isAdmin
              ? 'Create an event request for members to vote on!'
              : 'Check back later for new event proposals'}
          </div>
        </div>
      ) : (
        <div className="grid gap-6">
          {requests.map((request) => {
            const userVote = getUserVote(request);
            const votePercentage = getVotePercentage(request);

            return (
              <div key={request.id} className="bg-[#1a202c] rounded-xl shadow-md p-6 border border-gray-700">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-2">
                  <div className="text-lg font-semibold text-gray-100">{request.title}</div>
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${request.status === 'voting' ? 'bg-blue-900/50 text-blue-300 border-blue-700' : request.status === 'finalized' ? 'bg-green-900/50 text-green-300 border-green-700' : 'bg-gray-700 text-gray-300 border-gray-600'}`}>{request.status}</span>
                </div>

                {request.description && (
                  <div className="text-sm text-gray-400 mb-2">{request.description}</div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2 text-xs text-gray-400">
                  <div>Type: {request.eventType}</div>
                  <div>Location: {request.location || 'TBD'}</div>
                  <div>Start: {new Date(request.startTime).toLocaleString()}</div>
                  {request.maxPlayers && <div>Max Players: {request.maxPlayers}</div>}
                </div>

                {request.status === 'voting' && (
                  <>
                    <div className="mb-2">
                      <div className="flex justify-between text-xs mb-1">
                        <span>Yes: {request.yesVotes} | No: {request.noVotes}</span>
                        <span>{votePercentage.toFixed(0)}% approval</span>
                      </div>
                      <div className="w-full h-2 bg-gray-200 rounded">
                        <div
                          className={`h-2 rounded ${votePercentage >= 50 ? 'bg-green-500' : 'bg-red-500'}`}
                          style={{ width: `${votePercentage}%` }}
                        />
                      </div>
                    </div>
                    {userVote && (
                      <div className="bg-blue-50 text-blue-700 px-3 py-2 rounded mb-2 text-xs font-semibold">You voted: {userVote === 'yes' ? 'Yes' : 'No'}</div>
                    )}
                  </>
                )}

                <div className="flex flex-wrap gap-2 mt-2">
                  {request.status === 'voting' && (
                    <>
                      <button
                        className={`inline-flex items-center gap-1 px-4 py-2 rounded font-semibold border transition text-sm ${userVote === 'yes' ? 'bg-green-600 text-white border-green-600' : 'border-green-500 text-green-600 hover:bg-green-50'}`}
                        onClick={() => handleVote(request.id, 'yes')}
                        disabled={voting[request.id]}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 9V5a3 3 0 0 0-6 0v4" /><path d="M5 12h14" /><path d="M7 12v7a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-7" /></svg>
                        Yes
                      </button>
                      <button
                        className={`inline-flex items-center gap-1 px-4 py-2 rounded font-semibold border transition text-sm ${userVote === 'no' ? 'bg-red-600 text-white border-red-600' : 'border-red-500 text-red-600 hover:bg-red-50'}`}
                        onClick={() => handleVote(request.id, 'no')}
                        disabled={voting[request.id]}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M10 15V5a3 3 0 0 1 6 0v10" /><path d="M19 12H5" /></svg>
                        No
                      </button>
                      {isAdmin && (
                        <>
                          <button
                            className="inline-flex items-center gap-1 px-4 py-2 rounded font-semibold border border-blue-500 text-blue-600 hover:bg-blue-50 transition text-sm"
                            onClick={() => handleFinalize(request.id)}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M9 12l2 2l4-4" /></svg>
                            Finalize
                          </button>
                          <button
                            className="inline-flex items-center gap-1 px-4 py-2 rounded font-semibold border border-red-500 text-red-600 hover:bg-red-50 transition text-sm"
                            onClick={() => handleCancel(request.id)}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" /></svg>
                            Cancel
                          </button>
                        </>
                      )}
                    </>
                  )}
                  {request.status === 'finalized' && (
                    <div className="bg-green-50 text-green-700 px-3 py-2 rounded text-xs font-semibold w-full">Event created successfully!</div>
                  )}
                  {request.status === 'cancelled' && (
                    <div className="bg-red-50 text-red-700 px-3 py-2 rounded text-xs font-semibold w-full">Request cancelled</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Event Request Dialog */}
      {createDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-[#1a202c] rounded-xl shadow-lg p-6 w-full max-w-md border border-gray-700">
            <div className="text-lg font-semibold mb-4 text-gray-100">Create Event Request</div>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Title"
                value={newRequest.title}
                onChange={e => setNewRequest({ ...newRequest, title: e.target.value })}
                className="w-full px-3 py-2 rounded border border-gray-600 bg-[#0f1419] text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
                required
              />
              <textarea
                placeholder="Description"
                value={newRequest.description}
                onChange={e => setNewRequest({ ...newRequest, description: e.target.value })}
                className="w-full px-3 py-2 rounded border border-gray-600 bg-[#0f1419] text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
                rows={3}
              />
              <select
                value={newRequest.eventType}
                onChange={e => setNewRequest({ ...newRequest, eventType: e.target.value })}
                className="w-full px-3 py-2 rounded border border-gray-600 bg-[#0f1419] text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                {EVENT_TYPES.map((type) => (
                  <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Location"
                value={newRequest.location}
                onChange={e => setNewRequest({ ...newRequest, location: e.target.value })}
                className="w-full px-3 py-2 rounded border border-gray-600 bg-[#0f1419] text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
              />
              <input
                type="datetime-local"
                placeholder="Start Time"
                value={newRequest.startTime}
                onChange={e => setNewRequest({ ...newRequest, startTime: e.target.value })}
                className="w-full px-3 py-2 rounded border border-gray-600 bg-[#0f1419] text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <input
                type="datetime-local"
                placeholder="End Time"
                value={newRequest.endTime}
                onChange={e => setNewRequest({ ...newRequest, endTime: e.target.value })}
                className="w-full px-3 py-2 rounded border border-gray-600 bg-[#0f1419] text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="number"
                placeholder="Max Players"
                value={newRequest.maxPlayers}
                onChange={e => setNewRequest({ ...newRequest, maxPlayers: e.target.value })}
                className="w-full px-3 py-2 rounded border border-gray-600 bg-[#0f1419] text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
              />
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                onClick={() => setCreateDialogOpen(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleCreateRequest}
                disabled={!newRequest.title || !newRequest.startTime}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Snackbar */}
      {snackbar.open && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
          <div className={`px-6 py-3 rounded shadow-lg animate-fade-in text-white font-semibold ${snackbar.severity === 'success' ? 'bg-green-600' : snackbar.severity === 'error' ? 'bg-red-600' : 'bg-blue-600'}`}>
            {snackbar.message}
          </div>
        </div>
      )}
    </div>
  );
};

export default EventRequests;
