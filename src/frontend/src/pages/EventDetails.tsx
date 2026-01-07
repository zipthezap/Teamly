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
            <button onClick={() => navigate(`/events/${event.id}/edit`)} className="bg-blue-600 hover:bg-blue-700 text-white rounded-full p-2 transition-colors"><span className="material-icons">edit</span></button>
            <button onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white rounded-full p-2 transition-colors"><span className="material-icons">delete</span></button>
          </div>
        )}
        
        {/* Event Information Section */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-3 pr-24">{event.title}</h2>
          <div className="text-base text-[#a1a6b4] mb-3 font-medium">{event.eventType}</div>
          <div className="text-sm text-[#d4d8e1] mb-4 leading-relaxed">{event.description || 'No description'}</div>
          
          {/* Date, Time, Location */}
          <div className="flex flex-wrap items-center gap-4 mb-4 text-sm">
            <div className="flex items-center gap-2 bg-[#1a2233] px-3 py-2 rounded-lg">
              <span role="img" aria-label="date">📅</span>
              <span className="text-[#d4d8e1]">{new Date(event.startTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
            </div>
            <div className="flex items-center gap-2 bg-[#1a2233] px-3 py-2 rounded-lg">
              <span role="img" aria-label="time">🕐</span>
              <span className="text-[#d4d8e1]">{new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            {event.location && (
              <div className="flex items-center gap-2 bg-[#1a2233] px-3 py-2 rounded-lg">
                <span role="img" aria-label="location">📍</span>
                <span className="text-[#d4d8e1]">{event.location}</span>
              </div>
            )}
          </div>
          
          {/* Organizer Info */}
          <div className="flex items-center gap-3 bg-[#1a2233] rounded-lg px-4 py-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center text-lg font-bold flex-shrink-0">{getInitials(event.creator?.name)}</div>
            <div>
              <div className="text-xs text-[#a1a6b4] mb-0.5">Organized by</div>
              <div className="text-base font-semibold text-white">{event.creator?.name}</div>
            </div>
            <div className="ml-auto text-sm text-[#a1a6b4]">
              Group: <span className="font-bold text-blue-400">{event.group?.name}</span>
            </div>
          </div>
        </div>

        {/* Two Column Layout: Capacity + Attendance | Activity Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Capacity & Attendance */}
          <div className="flex flex-col gap-4">
            {/* Capacity Section */}
            <div className="bg-[#1a2233] rounded-lg p-5">
              <div className="font-semibold mb-3 text-lg">Event Capacity</div>
              <div className="text-sm text-[#a1a6b4] mb-3">{event.maxPlayers ? `${participantCount} / ${event.maxPlayers} participants` : `${participantCount} participants`}</div>
              {event.maxPlayers && (
                <div className="w-full bg-gray-700 rounded-full h-3 mb-3">
                  <div className="bg-blue-600 h-3 rounded-full transition-all" style={{ width: `${fillPercentage}%` }}></div>
                </div>
              )}
              <div className="flex flex-wrap gap-3 text-xs text-[#a1a6b4]">
                <span className="bg-[#232946] px-2 py-1 rounded">✅ {confirmedCount} confirmed</span>
                <span className="bg-[#232946] px-2 py-1 rounded">❌ {declinedCount} declined</span>
                <span className="bg-[#232946] px-2 py-1 rounded">⏳ {pendingCount} pending</span>
              </div>
            </div>
            
            {/* Attendance Actions */}
            <div className="bg-[#1a2233] rounded-lg p-5">
              <div className="font-semibold mb-3 text-lg">Your Attendance</div>
              <div className="flex flex-col gap-2">
                {!isParticipant && !isFull && (
                  <button onClick={handleJoin} className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-3 text-sm font-semibold transition-colors w-full">
                    Join Event
                  </button>
                )}
                {isParticipant && (
                  <>
                    <button onClick={() => handleUpdateStatus('confirmed')} className="bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-3 text-sm font-semibold transition-colors w-full">
                      ✓ Confirm Attendance
                    </button>
                    <button onClick={() => handleUpdateStatus('declined')} className="bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg px-4 py-3 text-sm font-semibold transition-colors w-full">
                      ✗ Decline
                    </button>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <button onClick={handleMarkLate} className="bg-gray-600 hover:bg-gray-700 text-white rounded-lg px-3 py-2 text-xs font-medium transition-colors">
                        ⏰ Mark Late
                      </button>
                      <button onClick={handleUnmarkLate} className="bg-gray-600 hover:bg-gray-700 text-white rounded-lg px-3 py-2 text-xs font-medium transition-colors">
                        ↩ Undo Late
                      </button>
                    </div>
                    {!isCreator && (
                      <button onClick={handleLeave} className="bg-pink-600 hover:bg-pink-700 text-white rounded-lg px-4 py-3 text-sm font-semibold transition-colors w-full mt-2">
                        Leave Event
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
          
          {/* Right Column: Activity Feed - Fixed Height */}
          <div className="bg-[#1a2233] rounded-lg p-5 flex flex-col max-h-[500px]">
            <div className="font-semibold mb-3 text-lg flex-shrink-0">Activity Feed</div>
            <div className="flex-1 overflow-y-auto text-sm text-[#a1a6b4] pr-2">
              {(event.eventNotifications || []).length === 0 ? (
                <div className="flex items-center justify-center h-full text-center">
                  <div>
                    <div className="text-4xl mb-2">📋</div>
                    <div>No activity yet.</div>
                  </div>
                </div>
              ) : (
                event.eventNotifications.map((n, idx) => (
                  <div key={idx} className="mb-3 pb-3 border-b border-[#232946] last:border-b-0">
                    <div className="flex items-start gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {getInitials(n.user?.name || 'User')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-medium text-sm mb-0.5">{n.user?.name || 'User'}</div>
                        <div className="text-xs text-[#a1a6b4] mb-1">{n.message}</div>
                        <div className="text-xs text-[#757b8a]">{new Date(n.createdAt).toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Participants List */}
      <div className="bg-[#232946] rounded-xl shadow-md p-6 mt-8">
        <div className="font-semibold mb-4 text-xl">Participants ({participantCount})</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {event.participants?.map((p, idx) => (
            <div key={p.id || idx} className="flex items-center gap-3 bg-[#1a2233] rounded-lg px-4 py-3">
              <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">{getInitials(p.user?.name)}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white truncate">{p.user?.name}</div>
                <div className="text-xs text-[#a1a6b4] truncate">{p.user?.email}</div>
                <div className="text-xs">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mt-1 ${
                    p.status === 'confirmed' ? 'bg-green-900/50 text-green-300' :
                    p.status === 'declined' ? 'bg-red-900/50 text-red-300' :
                    'bg-yellow-900/50 text-yellow-300'
                  }`}>
                    {p.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EventDetails;
