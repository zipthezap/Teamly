import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { eventsAPI, groupChatAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const EventDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [lateSuccess, setLateSuccess] = useState('');
  const [lateError, setLateError] = useState('');
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);

  const fetchEvent = useCallback(async () => {
    try {
      const response = await eventsAPI.getById(id);
      setEvent(response.data);
    } catch (error) {
      console.error('Error fetching event:', error);
      setError('Failed to load event');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  const handleJoin = async () => {
    setError('');
    setSuccess('');
    try {
      await eventsAPI.join(id);
      setSuccess('Successfully joined the event');
      fetchEvent();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to join event');
    }
  };

  const handleLeave = async () => {
    if (!window.confirm('Are you sure you want to leave this event?')) return;
    
    setError('');
    setSuccess('');
    try {
      await eventsAPI.leave(id);
      setSuccess('Successfully left the event');
      fetchEvent();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to leave event');
    }
  };

  const handleUpdateStatus = async (status: string) => {
    setError('');
    setSuccess('');
    try {
      await eventsAPI.updateStatus(id, status);
      setSuccess(`Status updated to ${status}`);
      fetchEvent();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update status');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this event? This action cannot be undone.')) return;
    
    try {
      await eventsAPI.delete(id);
      navigate('/events');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete event');
    }
  };

  const handleMarkLate = async () => {
    setLateError('');
    setLateSuccess('');
    try {
      await groupChatAPI.markLate(id);
      setLateSuccess('Marked as late.');
      fetchEvent();
    } catch (err) {
      setLateError('Failed to mark as late');
    }
  };

  const handleUnmarkLate = async () => {
    setLateError('');
    setLateSuccess('');
    try {
      await groupChatAPI.unmarkLate(id);
      setLateSuccess('Late status undone.');
      fetchEvent();
    } catch (err) {
      setLateError('Failed to undo late');
    }
  };

  const getInitials = (name: string) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const isParticipant = event?.participants?.find((p: any) => p.userId === user?.id);
  const isCreator = event?.creatorId === user?.id;
  const isFull = event?.maxPlayers && event?.participants?.length >= event?.maxPlayers;

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[80vh]">
        <div className="w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="max-w-2xl mx-auto mt-8">
        <div className="bg-red-900/50 text-red-300 p-4 rounded border border-red-700">Event not found</div>
      </div>
    );
  }

  const participantCount = event.participants?.length || 0;
  const confirmedCount = event.participants?.filter((p: any) => p.status === 'confirmed').length || 0;
  const declinedCount = event.participants?.filter((p: any) => p.status === 'declined').length || 0;
  const pendingCount = participantCount - confirmedCount - declinedCount;
  const fillPercentage = event.maxPlayers ? (participantCount / event.maxPlayers) * 100 : 0;

  return (
    <div className="max-w-5xl mx-auto mt-8 mb-8 px-2">
      {/* Alerts */}
      {error && <div className="bg-red-900/50 text-red-300 p-3 rounded mb-4 border border-red-700">{error}</div>}
      {success && <div className="bg-green-900/50 text-green-300 p-3 rounded mb-4 border border-green-700">{success}</div>}
      {lateSuccess && <div className="bg-green-900/50 text-green-300 p-3 rounded mb-4 border border-green-700">{lateSuccess}</div>}
      {lateError && <div className="bg-red-900/50 text-red-300 p-3 rounded mb-4 border border-red-700">{lateError}</div>}

      <div className="relative bg-[#232946] rounded-xl shadow-md p-6 mb-8">
        {/* Admin icon buttons in top right */}
        {isCreator && (
          <div className="absolute top-4 right-4 flex gap-2 z-10">
            <button onClick={() => navigate(`/events/${event.id}/edit`)} className="bg-blue-600 hover:bg-blue-700 text-white rounded-full p-2"><span className="material-icons">edit</span></button>
            <button onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white rounded-full p-2"><span className="material-icons">delete</span></button>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          {/* Main: Event Info */}
          <div className="md:col-span-2 flex flex-col gap-6">
            {/* Event Information */}
            <div>
              <h2 className="text-xl font-bold mb-2">{event.title}</h2>
              <div className="text-sm text-[#a1a6b4] mb-2">{event.eventType}</div>
              <div className="text-sm text-[#a1a6b4] mb-2">{event.description || 'No description'}</div>
              <div className="flex items-center gap-2 mb-2">
                <span role="img" aria-label="date">📅</span>
                <span className="text-xs text-[#a1a6b4]">{new Date(event.startTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                <span role="img" aria-label="time">🕐</span>
                <span className="text-xs text-[#a1a6b4]">{new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                {event.location && <><span role="img" aria-label="location">📍</span><span className="text-xs text-[#a1a6b4]">{event.location}</span></>}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <div className="w-10 h-10 rounded-full bg-blue-700 text-white flex items-center justify-center text-lg font-bold">{getInitials(event.creator?.name)}</div>
                <div>
                  <div className="text-xs text-[#a1a6b4]">Organized by</div>
                  <div className="text-sm font-semibold">{event.creator?.name}</div>
                </div>
                <div className="ml-auto text-xs text-[#a1a6b4]">Group: <span className="font-bold">{event.group?.name}</span></div>
              </div>
            </div>
          </div>
          {/* Middle: Capacity & Attendance + Activity Feed in a row */}
          <div className="md:col-span-3 flex flex-col gap-6">
            {/* Capacity Section */}
            <div className="bg-[#1a2233] rounded-lg p-4 mb-2">
              <div className="font-semibold mb-2">Event Capacity</div>
              <div className="text-sm text-[#a1a6b4] mb-2">{event.maxPlayers ? `${participantCount} / ${event.maxPlayers} participants` : `${participantCount} participants`}</div>
              {event.maxPlayers && (
                <div className="w-full bg-gray-700 rounded-full h-3 mb-2">
                  <div className="bg-blue-600 h-3 rounded-full" style={{ width: `${fillPercentage}%` }}></div>
                </div>
              )}
              <div className="flex gap-4 mt-2 text-xs text-[#a1a6b4]">
                <span>✅ {confirmedCount} confirmed</span>
                <span>❌ {declinedCount} declined</span>
                <span>⏳ {pendingCount} pending</span>
              </div>
            </div>
            {/* Attendance Actions */}
            <div className="bg-[#1a2233] rounded-lg p-4 mb-2">
              <div className="font-semibold mb-2">Attendance</div>
              {/* Actions: Join, Leave, Status, Mark Late, etc. */}
              <div className="flex flex-wrap gap-2">
                {!isParticipant && !isFull && <button onClick={handleJoin} className="bg-blue-600 hover:bg-blue-700 text-white rounded-md px-3 py-1.5 text-sm">Join Event</button>}
                {isParticipant && <button onClick={handleLeave} className="bg-pink-600 hover:bg-pink-700 text-white rounded-md px-3 py-1.5 text-sm">Leave Event</button>}
                {isParticipant && <button onClick={() => handleUpdateStatus('confirmed')} className="bg-green-600 hover:bg-green-700 text-white rounded-md px-3 py-1.5 text-sm">Confirm</button>}
                {isParticipant && <button onClick={() => handleUpdateStatus('declined')} className="bg-yellow-600 hover:bg-yellow-700 text-white rounded-md px-3 py-1.5 text-sm">Decline</button>}
                <button onClick={handleMarkLate} className="bg-gray-600 hover:bg-gray-700 text-white rounded-md px-3 py-1.5 text-sm">Mark Late</button>
                <button onClick={handleUnmarkLate} className="bg-gray-600 hover:bg-gray-700 text-white rounded-md px-3 py-1.5 text-sm">Undo Late</button>
              </div>
            </div>
            {/* Activity Feed */}
            <div className="bg-[#1a2233] rounded-lg p-4">
              <div className="font-semibold mb-2">Activity Feed</div>
              <div className="max-h-40 overflow-y-auto text-xs text-[#a1a6b4]">
                {(event.eventNotifications || []).length === 0 ? (
                  <div>No activity yet.</div>
                ) : (
                  event.eventNotifications.map((n, idx) => (
                    <div key={idx} className="mb-2 border-b border-[#232946] pb-1">
                      <span className="font-semibold text-white">{n.user?.name || 'User'}</span>: {n.message} <span className="ml-2 text-[#a1a6b4]">{new Date(n.createdAt).toLocaleString()}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Participants List */}
      <div className="bg-[#232946] rounded-xl shadow-md p-6 mt-8">
        <div className="font-semibold mb-4">Participants ({participantCount})</div>
        <div className="flex flex-wrap gap-4">
          {event.participants?.map((p, idx) => (
            <div key={p.id || idx} className="flex items-center gap-2 bg-[#1a2233] rounded-lg px-3 py-2">
              <div className="w-8 h-8 rounded-full bg-blue-700 text-white flex items-center justify-center text-xs font-bold">{getInitials(p.user?.name)}</div>
              <div>
                <div className="text-sm font-semibold text-white">{p.user?.name}</div>
                <div className="text-xs text-[#a1a6b4]">{p.user?.email}</div>
                <div className="text-xs text-[#a1a6b4]">Status: {p.status}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EventDetails;
