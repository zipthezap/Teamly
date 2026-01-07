
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { groupsAPI, groupChatAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const GroupPageModern = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const fetchGroup = useCallback(async () => {
    try {
      const response = await groupsAPI.getById(id);
      setGroup(response.data);
    } catch (error) {
      setError('Failed to load group');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchGroup();
  }, [fetchGroup]);

  const fetchMessages = useCallback(async () => {
    setChatLoading(true);
    try {
      const res = await groupChatAPI.getMessages(id);
      setMessages(res.data);
    } catch (e) {
      // Optionally handle error
    } finally {
      setChatLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 30000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  const handleInvite = async () => {
    setError('');
    setSuccess('');
    try {
      await groupsAPI.invite(id, inviteEmail);
      setSuccess('Member invited successfully');
      setInviteEmail('');
      setInviteDialogOpen(false);
      fetchGroup();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to invite member');
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!window.confirm('Are you sure you want to remove this member?')) return;
    try {
      await groupsAPI.removeMember(id, memberId);
      setSuccess('Member removed successfully');
      fetchGroup();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove member');
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    try {
      await groupChatAPI.sendMessage(id, newMessage);
      setNewMessage('');
      fetchMessages();
    } catch (e) {
      // Optionally handle error
    }
  };

  const handleLeaveGroup = async () => {
    if (!window.confirm('Are you sure you want to leave this group?')) return;
    try {
      await groupsAPI.leave(id);
      setSuccess('Left group successfully');
      setTimeout(() => {
        navigate('/groups');
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to leave group');
    }
  };

  const handleCopyInviteLink = async () => {
    try {
      const response = await groupsAPI.getInviteLink(id);
      const inviteLink = `${window.location.origin}/groups/join/${response.data.groupId}`;
      await navigator.clipboard.writeText(inviteLink);
      setSnackbarMessage('Invite link copied to clipboard!');
      setSnackbarOpen(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to get invite link');
    }
  };

  const handleDeleteGroup = async () => {
    if (!window.confirm('Are you sure you want to delete this group? This action cannot be undone and will delete all events associated with the group.')) return;
    try {
      await groupsAPI.delete(id);
      setSuccess('Group deleted successfully');
      setTimeout(() => {
        navigate('/groups');
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete group');
    }
  };

  const isAdmin = group?.members?.find(
    (m) => m.userId === user?.id && m.role === 'admin'
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[80vh]">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="max-w-2xl mx-auto mt-8">
        <div className="bg-red-900/50 text-red-300 p-4 rounded border border-red-700">Group not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a2233] to-[#232946] p-6 font-sans text-white">
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Group Info */}
        <div className="md:col-span-3">
          <div className="bg-[#232946] rounded-xl shadow-md p-6 flex flex-col md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold mb-1 flex items-center">
                {group.name}
                {/* Bell notification icon */}
                <span className="ml-2 align-middle">
                  <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0 1 18 14.158V11a6.002 6.002 0 0 0-4-5.659V5a2 2 0 1 0-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 0 1-6 0v-1m6 0H9" /></svg>
                </span>
              </h1>
            </div>
            <div className="flex flex-wrap gap-2 mt-4 md:mt-0">
              {/* Copy Link (chain) */}
              <button title="Copy Invite Link" onClick={handleCopyInviteLink} className="border border-blue-500 text-blue-500 bg-transparent rounded-md p-2 flex items-center justify-center hover:bg-blue-900/20 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 7a5 5 0 0 0-7.07 0l-3.88 3.88a5 5 0 0 0 7.07 7.07l1.06-1.06" /><path d="M7 17a5 5 0 0 0 7.07 0l3.88-3.88a5 5 0 0 0-7.07-7.07l-1.06 1.06" /></svg>
              </button>
              {/* Add (plus) */}
              <button title="Add" className="border border-blue-500 text-blue-500 bg-transparent rounded-md p-2 flex items-center justify-center hover:bg-blue-900/20 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" /></svg>
              </button>
              {/* Invite (user-plus) */}
              <button title="Invite Member" onClick={() => setInviteDialogOpen(true)} className="border border-blue-500 text-blue-500 bg-transparent rounded-md p-2 flex items-center justify-center hover:bg-blue-900/20 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M16 11V9a4 4 0 1 0-8 0v2M12 19c-4 0-8-2-8-6V9a8 8 0 0 1 16 0v4c0 4-4 6-8 6zm6-2v-2m0 0h2m-2 0h-2" /></svg>
              </button>
              {/* Edit (pencil) */}
              <button title="Edit Group" onClick={() => navigate(`/groups/${id}/edit`)} className="border border-blue-500 text-blue-500 bg-transparent rounded-md p-2 flex items-center justify-center hover:bg-blue-900/20 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19.5 3 21l1.5-4L16.5 3.5z" /></svg>
              </button>
              {/* Delete (trash) */}
              <button title="Delete Group" onClick={handleDeleteGroup} className="border border-red-500 text-red-500 bg-transparent rounded-md p-2 flex items-center justify-center hover:bg-red-900/20 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
              </button>
              {/* Arrow (navigate/forward) */}
              <button title="Go" className="border border-gray-500 text-gray-400 bg-transparent rounded-md p-2 flex items-center justify-center hover:bg-gray-800/20 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
            {/* Event Request Button (large, below actions) */}
            {isAdmin && (
              <div className="mt-3">
                <button onClick={() => navigate(`/event-requests/${id}`)} className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-lg px-4 py-3 text-base shadow transition flex items-center justify-center gap-2">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 8v4m0 4h.01M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z" /></svg>
                  Event Requests
                </button>
              </div>
            )}
          </div>
        </div>
        {/* Members */}
        <div className="bg-[#232946] rounded-xl shadow-md p-4">
          <h2 className="text-lg font-semibold mb-4">Members <span className="text-[#a1a6b4]">({group.members?.length || 0})</span></h2>
          <ul className="space-y-3">
            {group.members?.map((member) => (
              <li key={member.id} className="flex items-center justify-between">
                <div>
                  <span className="font-bold">{member.user?.name}</span>
                  {member.role === 'admin' && <span className="ml-2 text-xs bg-[#232946] text-[#a1a6b4] px-2 py-0.5 rounded">Admin</span>}
                  <div className="text-xs text-[#a1a6b4]">{member.user?.email}</div>
                </div>
                {isAdmin && member.userId !== user.id && (
                  <button onClick={() => handleRemoveMember(member.id)} className="bg-red-600 hover:bg-red-700 text-white rounded px-2 py-1 text-xs transition">Remove</button>
                )}
              </li>
            ))}
          </ul>
        </div>
        {/* Events */}
        <div className="bg-[#232946] rounded-xl shadow-md p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Events <span className="text-[#a1a6b4]">({group.events?.length || 0})</span></h2>
            {isAdmin && <button onClick={() => navigate('/events/new', { state: { groupId: id } })} className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md px-3 py-1.5 text-sm shadow transition">Create Event</button>}
          </div>
          {group.events?.length > 0 ? group.events.map((event) => (
            <div key={event.id} onClick={() => navigate(`/events/${event.id}`)} className="bg-[#1a2233] rounded-lg p-3 mb-2 hover:shadow-md transition cursor-pointer">
              <div className="font-semibold">{event.title}</div>
              <div className="text-xs text-[#a1a6b4]">{event.eventType} - {new Date(event.startTime).toLocaleDateString()}</div>
            </div>
          )) : <div className="text-[#a1a6b4]">No events yet.</div>}
        </div>
        {/* Group Chat */}
        <div className="bg-[#232946] rounded-xl shadow-md p-4">
          <h2 className="text-lg font-semibold mb-4">Group Chat</h2>
          <div className="bg-[#1a2233] rounded-lg p-3 mb-2 min-h-[60px] text-[#a1a6b4] max-h-60 overflow-y-auto">
            {chatLoading ? (
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
            ) : messages.length === 0 ? (
              <div>No messages yet.</div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className="mb-2">
                  <div className="text-blue-300 font-semibold text-xs">{msg.user?.name || 'User'}</div>
                  <div className="text-white text-sm">{msg.content}</div>
                  <div className="text-xs text-[#a1a6b4]">{new Date(msg.createdAt).toLocaleString()}</div>
                </div>
              ))
            )}
          </div>
          <form onSubmit={handleSendMessage} className="flex gap-2 mt-2">
            <input
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              className="flex-1 bg-[#1a2233] border border-[#3a3f4b] rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-[#3a86ff]"
              placeholder="Type a message..."
            />
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md px-3 py-1.5 text-sm shadow transition" disabled={!newMessage.trim()}>Send</button>
          </form>
        </div>
      </div>
      {/* Invite Member Dialog */}
      {inviteDialogOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <div className="bg-[#232946] rounded-xl shadow-lg p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold mb-4">Invite Member</h3>
            <input
              type="email"
              className="w-full mb-4 bg-[#1a2233] border border-[#3a3f4b] rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-[#3a86ff]"
              placeholder="Email Address"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setInviteDialogOpen(false)} className="bg-gray-600 hover:bg-gray-700 text-white rounded-md px-3 py-1.5 text-sm">Cancel</button>
              <button onClick={handleInvite} className="bg-blue-600 hover:bg-blue-700 text-white rounded-md px-3 py-1.5 text-sm">Invite</button>
            </div>
          </div>
        </div>
      )}
      {/* Snackbar for invite link copied */}
      {snackbarOpen && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-blue-700 text-white px-4 py-2 rounded shadow z-50">
          {snackbarMessage}
        </div>
      )}
      {/* Error/Success Alerts */}
      {error && <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded shadow z-50">{error}</div>}
      {success && <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded shadow z-50">{success}</div>}
    </div>
  );
};

export default GroupPageModern;
