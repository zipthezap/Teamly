
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { groupsAPI, groupChatAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import {
  BellIcon,
  LinkIcon,
  PlusIcon,
  UserPlusIcon,
  EditIcon,
  TrashIcon,
  ChevronRightIcon,
  AlertCircleIcon
} from '../components/icons';

const GroupPage = () => {
  const { t } = useTranslation();
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
      setError('groupDetails.failedToLoad');
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
                  <BellIcon className="w-6 h-6 text-blue-400" />
                </span>
              </h1>
            </div>
            <div className="flex flex-wrap gap-2 mt-4 md:mt-0">
              {/* Copy Link (link icon) */}
              <button title={t('groupDetails.inviteLinkCopied')} onClick={handleCopyInviteLink} className="border border-blue-500 text-blue-500 bg-transparent rounded-md p-2 flex items-center justify-center hover:bg-blue-900/20 transition">
                <LinkIcon className="w-5 h-5" />
              </button>
              {/* Add (plus) */}
              <button title={t('common.create')} className="border border-blue-500 text-blue-500 bg-transparent rounded-md p-2 flex items-center justify-center hover:bg-blue-900/20 transition">
                <PlusIcon className="w-5 h-5" />
              </button>
              {/* Invite (user-plus) */}
              <button title={t('groupDetails.inviteMember')} onClick={() => setInviteDialogOpen(true)} className="border border-blue-500 text-blue-500 bg-transparent rounded-md p-2 flex items-center justify-center hover:bg-blue-900/20 transition">
                <UserPlusIcon className="w-5 h-5" />
              </button>
              {/* Edit (pencil) */}
              <button title={t('groups.editGroup')} onClick={() => navigate(`/groups/${id}/edit`)} className="border border-blue-500 text-blue-500 bg-transparent rounded-md p-2 flex items-center justify-center hover:bg-blue-900/20 transition">
                <EditIcon className="w-5 h-5" />
              </button>
              {/* Delete (trash) */}
              <button title={t('common.delete')} onClick={handleDeleteGroup} className="border border-red-500 text-red-500 bg-transparent rounded-md p-2 flex items-center justify-center hover:bg-red-900/20 transition">
                <TrashIcon className="w-5 h-5" />
              </button>
              {/* Arrow (navigate/forward) */}
              <button title={t('common.viewDetails')} className="border border-gray-500 text-gray-400 bg-transparent rounded-md p-2 flex items-center justify-center hover:bg-gray-800/20 transition">
                <ChevronRightIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
          {/* Event Request Button (smaller, just below action buttons) */}
          {/* Only non-admin group members can submit event requests. Admins see only the management button. */}
          {isAdmin ? (
            <div className="mt-2 flex w-full justify-center">
              <button onClick={() => navigate(`/event-requests/${id}`)} className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold rounded-md px-4 py-2 text-base shadow-md transition flex items-center justify-center gap-2" style={{ minWidth: '220px', maxWidth: '260px' }}>
                <AlertCircleIcon className="w-5 h-5" />
                {t('eventRequests.title')}
              </button>
            </div>
          ) : (
            <div className="mt-2 flex w-full justify-center">
              <button onClick={() => navigate(`/event-requests/${id}/new`)} className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold rounded-md px-4 py-2 text-base shadow-md transition flex items-center justify-center gap-2" style={{ minWidth: '220px', maxWidth: '260px' }}>
                <AlertCircleIcon className="w-5 h-5" />
                {t('eventRequests.createRequest')}
              </button>
            </div>
          )}
        </div>
        {/* Members */}
        <div className="bg-[#232946] rounded-xl shadow-md p-4">
          <h2 className="text-lg font-semibold mb-4">{t('groupDetails.members', { count: group.members?.length || 0 })}</h2>
          <ul className="space-y-3">
            {group.members?.map((member) => (
              <li key={member.id} className="flex items-center justify-between">
                <div>
                  <span className="font-bold">{member.user?.name}</span>
                  {member.role === 'admin' && <span className="ml-2 text-xs bg-[#232946] text-[#a1a6b4] px-2 py-0.5 rounded">{t('groupDetails.admin')}</span>}
                  <div className="text-xs text-[#a1a6b4]">{member.user?.email}</div>
                </div>
                {isAdmin && member.userId !== user.id && (
                  <button onClick={() => handleRemoveMember(member.id)} className="bg-red-600 hover:bg-red-700 text-white rounded px-2 py-1 text-xs transition">{t('groups.removeMember')}</button>
                )}
              </li>
            ))}
          </ul>
        </div>
        {/* Events */}
        <div className="bg-[#232946] rounded-xl shadow-md p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">{t('events.eventsFound', { count: group.events?.length || 0 })}</h2>
            {isAdmin && <button onClick={() => navigate('/events/new', { state: { groupId: id } })} className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md px-3 py-1.5 text-sm shadow transition">{t('events.createEvent')}</button>}
          </div>
          {group.events?.length > 0 ? group.events.map((event) => (
            <div key={event.id} onClick={() => navigate(`/events/${event.id}`)} className="bg-[#1a2233] rounded-lg p-3 mb-2 hover:shadow-md transition cursor-pointer">
              <div className="font-semibold">{event.title}</div>
              <div className="text-xs text-[#a1a6b4]">{t(`events.types.${event.eventType}`)} - {new Date(event.startTime).toLocaleDateString()}</div>
            </div>
          )) : <div className="text-[#a1a6b4]">{t('groupDetails.noEvents')}</div>}
        </div>
        {/* Group Chat */}
        <div className="bg-[#232946] rounded-xl shadow-md p-4">
          <h2 className="text-lg font-semibold mb-4">{t('groupDetails.groupChat')}</h2>
          <div className="bg-[#1a2233] rounded-lg p-3 mb-2 min-h-[60px] text-[#a1a6b4] max-h-60 overflow-y-auto">
            {chatLoading ? (
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
            ) : messages.length === 0 ? (
              <div>{t('groupDetails.noMessages')}</div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className="mb-2">
                  <div className="text-blue-300 font-semibold text-xs">{msg.user?.name || t('groupDetails.user')}</div>
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
              placeholder={t('groupDetails.typeMessage')}
            />
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md px-3 py-1.5 text-sm shadow transition" disabled={!newMessage.trim()}>{t('groupDetails.send')}</button>
          </form>
        </div>
      </div>
      {/* Invite Member Dialog */}
      {inviteDialogOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <div className="bg-[#232946] rounded-xl shadow-lg p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold mb-4">{t('groupDetails.inviteMember')}</h3>
            <input
              type="email"
              className="w-full mb-4 bg-[#1a2233] border border-[#3a3f4b] rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-[#3a86ff]"
              placeholder={t('groups.emailAddress')}
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setInviteDialogOpen(false)} className="bg-gray-600 hover:bg-gray-700 text-white rounded-md px-3 py-1.5 text-sm">{t('common.cancel')}</button>
              <button onClick={handleInvite} className="bg-blue-600 hover:bg-blue-700 text-white rounded-md px-3 py-1.5 text-sm">{t('groupDetails.invite')}</button>
            </div>
          </div>
        </div>
      )}
      {/* Snackbar for invite link copied */}
      {snackbarOpen && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-blue-700 text-white px-4 py-2 rounded shadow z-50">
          {t(snackbarMessage)}
        </div>
      )}
      {/* Error/Success Alerts */}
      {error && <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded shadow z-50">{t(error)}</div>}
      {success && <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded shadow z-50">{t(success)}</div>}
    </div>
  );
};

export default GroupPage;
