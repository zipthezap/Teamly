import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Box,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Chip,
  Snackbar,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import LinkIcon from '@mui/icons-material/Link';
import { groupsAPI, groupChatAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import JoinRequestsPopover from '../components/JoinRequestsPopover';

const GroupDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
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
      console.error('Error fetching group:', error);
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
    // Poll for new messages every 30s (reduced frequency to optimize API usage)
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
        <svg className="animate-spin text-blue-500" width={48} height={48} viewBox="0 0 50 50" fill="none"><circle className="opacity-20" cx="25" cy="25" r="20" stroke="currentColor" strokeWidth="6" /><path className="opacity-80" d="M45 25c0-11.046-8.954-20-20-20" stroke="currentColor" strokeWidth="6" strokeLinecap="round" /></svg>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="max-w-4xl mx-auto mt-8">
        <div className="bg-red-900/50 text-red-300 p-4 rounded border border-red-700">Group not found.</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto mt-8 mb-8 px-4">
      {error && <div className="bg-red-900/50 text-red-300 p-3 rounded mb-3 border border-red-700">{error}</div>}
      {success && <div className="bg-green-900/50 text-green-300 p-3 rounded mb-3 border border-green-700">{success}</div>}

      <div className="bg-[#1a202c] rounded-xl shadow-md p-6 mb-6 border border-gray-700">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
          <div>
            <div className="text-2xl font-bold mb-2 text-gray-100">{group.name}</div>
            <div className="text-base text-gray-400 mb-2">{group.description || 'No description'}</div>
            <div className="text-xs text-gray-400">Created by {group.creator?.name} on {new Date(group.createdAt).toLocaleDateString()}</div>
          </div>
          <div className="flex flex-wrap gap-2 items-center mt-4 md:mt-0">
            {isAdmin && (
              <JoinRequestsPopover groupId={id} />
            )}
            <button
              className="inline-flex items-center gap-2 px-4 py-2 border border-blue-500 text-blue-600 rounded-md font-semibold hover:bg-blue-50 transition"
              onClick={handleCopyInviteLink}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 1 7 7l-7-7zm-7-7a5 5 0 0 1 7 7l-7-7z" /></svg>
              Copy Invite Link
            </button>
            {isAdmin && (
              <>
                <button
                  className="inline-flex items-center gap-2 px-4 py-2 border border-blue-500 text-blue-600 rounded-md font-semibold hover:bg-blue-50 transition"
                  onClick={() => navigate(`/event-requests/${id}`)}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 8v8M8 12h8" /></svg>
                  Event Requests
                </button>
                <button
                  className="inline-flex items-center gap-2 px-4 py-2 border border-blue-500 text-blue-600 rounded-md font-semibold hover:bg-blue-50 transition"
                  onClick={() => setInviteDialogOpen(true)}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="7" r="4" /><path d="M17 21v-2a4 4 0 0 0-8 0v2" /></svg>
                  Invite Member
                </button>
                <button
                  className="inline-flex items-center gap-2 px-4 py-2 border border-blue-500 text-blue-600 rounded-md font-semibold hover:bg-blue-50 transition"
                  onClick={() => navigate(`/groups/${id}/edit`)}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19.5 3 21l1.5-4L16.5 3.5z" /></svg>
                  Edit Group
                </button>
                <button
                  className="inline-flex items-center gap-2 px-4 py-2 border border-red-500 text-red-600 rounded-md font-semibold hover:bg-red-50 transition"
                  onClick={handleDeleteGroup}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v3" /></svg>
                  Delete Group
                </button>
              </>
            )}
            <button
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-600 text-gray-300 rounded-md font-semibold hover:bg-gray-700 transition"
              onClick={handleLeaveGroup}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 16l4-4m0 0l-4-4m4 4H7" /><circle cx="5" cy="12" r="2" /></svg>
              Leave Group
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Members Card */}
        <div className="bg-[#1a202c] rounded-xl shadow-md p-6 border border-gray-700">
          <div className="text-lg font-semibold mb-4 text-gray-100">Members ({group.members?.length || 0})</div>
          <ul>
            {group.members?.map((member) => (
              <li key={member.id} className="flex items-center justify-between py-2 border-b border-gray-700 last:border-b-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-medium text-gray-200">{member.user?.name}</div>
                    {member.role === 'admin' && (
                      <span className="flex-shrink-0 px-2 py-0.5 rounded bg-blue-100 text-blue-600 text-xs font-semibold whitespace-nowrap">Admin</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400">
                    {member.user?.email}
                  </div>
                </div>
                {isAdmin && member.userId !== user.id && (
                  <button
                    className="text-red-500 hover:text-red-700 p-2 rounded-full transition"
                    onClick={() => handleRemoveMember(member.id)}
                    title="Remove member"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v3" /></svg>
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Events Card */}
        <div className="bg-[#1a202c] rounded-xl shadow-md p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="text-lg font-semibold text-gray-100">Events ({group.events?.length || 0})</div>
            <button
              className="inline-flex items-center gap-2 px-4 py-2 border border-blue-600 text-blue-400 rounded-md font-semibold hover:bg-blue-900/30 transition text-sm"
              onClick={() => navigate('/events/new', { state: { groupId: id } })}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 8v8M8 12h8" /></svg>
              Create Event
            </button>
          </div>
          <ul>
            {group.events?.map((event) => (
              <li
                key={event.id}
                className="py-2 px-2 rounded-lg cursor-pointer transition hover:bg-gray-700"
                onClick={() => navigate(`/events/${event.id}`)}
              >
                <div className="font-medium text-gray-200">{event.title}</div>
                <div className="text-xs text-gray-400">{event.eventType} - {new Date(event.startTime).toLocaleDateString()}</div>
              </li>
            ))}
            {(!group.events || group.events.length === 0) && (
              <li className="text-xs text-gray-400 py-2">No events yet</li>
            )}
          </ul>
        </div>

        {/* Group Chat Card */}
        <div className="col-span-1 md:col-span-2">
          <div className="bg-[#1a202c] rounded-xl shadow-md p-6 border border-gray-700">
            <div className="text-lg font-semibold mb-4 text-gray-100">Group Chat</div>
            <div className="max-h-64 overflow-y-auto mb-4 bg-[#0f1419] p-3 rounded border border-gray-700">
              {chatLoading ? (
                <div className="flex justify-center items-center py-8">
                  <svg className="animate-spin text-blue-500" width={24} height={24} viewBox="0 0 50 50" fill="none"><circle className="opacity-20" cx="25" cy="25" r="20" stroke="currentColor" strokeWidth="6" /><path className="opacity-80" d="M45 25c0-11.046-8.954-20-20-20" stroke="currentColor" strokeWidth="6" strokeLinecap="round" /></svg>
                </div>
              ) : messages.length === 0 ? (
                <div className="text-xs text-gray-400">No messages yet.</div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className="mb-3">
                    <div className="font-semibold text-blue-400 text-sm">{msg.user?.name || 'User'}</div>
                    <div className="text-sm mb-1 text-gray-200">{msg.content}</div>
                    <div className="text-xs text-gray-400">{new Date(msg.createdAt).toLocaleString()}</div>
                  </div>
                ))
              )}
            </div>
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 px-3 py-2 rounded border border-gray-600 bg-[#0f1419] text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
                type="text"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 transition text-sm disabled:opacity-60"
                disabled={!newMessage.trim()}
              >
                Send
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Invite Member Dialog */}
      {inviteDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-[#1a202c] rounded-xl shadow-lg p-6 w-full max-w-md border border-gray-700">
            <div className="text-lg font-semibold mb-4 text-gray-100">Invite Member</div>
            <input
              type="email"
              placeholder="Email Address"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              className="w-full px-3 py-2 mb-4 rounded border border-gray-600 bg-[#0f1419] text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
            />
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 rounded bg-gray-200 text-gray-700 font-semibold hover:bg-gray-300 transition"
                onClick={() => setInviteDialogOpen(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
                onClick={handleInvite}
              >
                Invite
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Snackbar for invite link copied */}
      {snackbarOpen && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-blue-600 text-white px-6 py-3 rounded shadow-lg animate-fade-in">
            {snackbarMessage}
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupDetails;
