  import Dialog from '@mui/material/Dialog';
  import DialogTitle from '@mui/material/DialogTitle';
  import DialogContent from '@mui/material/DialogContent';
  import DialogActions from '@mui/material/DialogActions';
  import TextField from '@mui/material/TextField';
  import Button from '@mui/material/Button';
  import MenuItem from '@mui/material/MenuItem';
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [settingsForm, setSettingsForm] = useState({
      name: '',
      description: '',
      privacy: 'public',
    });

    useEffect(() => {
      if (group && settingsOpen) {
        setSettingsForm({
          name: group.name || '',
          description: group.description || '',
          privacy: group.privacy || 'public',
        });
      }
    }, [group, settingsOpen]);

    const updateGroupMutation = useMutation(
      (data: any) => groupsAPI.update(groupId!, data),
      {
        onSuccess: () => {
          setToast({ message: 'Group updated successfully', type: 'success' });
          setSettingsOpen(false);
          queryClient.invalidateQueries(["groupDetails", groupId]);
        },
        onError: (err: any) => {
          setToast({ message: err?.message || 'Failed to update group', type: 'error' });
        },
      }
    );

    const handleSettingsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setSettingsForm({ ...settingsForm, [e.target.name]: e.target.value });
    };

    const handleSettingsSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      updateGroupMutation.mutate(settingsForm);
    };
  // Event deletion mutation
  const deleteEventMutation = useMutation(
    async (eventId: number) => {
      await eventsAPI.delete(eventId);
      return eventId;
    },
    {
      onSuccess: () => {
        setToast({ message: "Event deleted successfully", type: "success" });
        refetchEvents();
      },
      onError: (err: any) => {
        setToast({ message: err?.message || "Failed to delete event", type: "error" });
      },
    }
  );



import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import GroupHeader from "../components/GroupDetails/GroupHeader";
import MemberList from "../components/GroupDetails/MemberList";
import EventList from "../components/GroupDetails/EventList";
import EventFormModal from "../components/event/EventFormModal";
import ChatBox from "../components/GroupDetails/ChatBox";
import { Group, Member, ChatMessage } from "../types/group";
import { groupsAPI, eventsAPI, groupChatAPI } from "../services/api";

// Simple toast system
function Toast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
  return (
    <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded shadow-lg text-white ${type === "success" ? "bg-green-600" : "bg-red-600"}`}>
      {message}
      <button className="ml-4 font-bold" onClick={onClose}>×</button>
    </div>
  );
}


export default function GroupDetailsPage() {
  // ...existing code...
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<any>(null);
  const { id: groupId } = useParams();
  const queryClient = useQueryClient();

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Fetch group details
  const { data: group, isLoading: groupLoading, error: groupError } = useQuery([
    "groupDetails",
    groupId,
  ], async () => {
    const res = await groupsAPI.getById(groupId!);
    return res.data;
  }, { enabled: !!groupId });

  // Fetch events for this group
  const { data: events, isLoading: eventsLoading, error: eventsError, refetch: refetchEvents } = useQuery([
    "groupEvents",
    groupId,
  ], async () => {
    const res = await eventsAPI.getAll({ groupId });
    return res.data;
  }, { enabled: !!groupId });

  // Fetch chat messages for this group
  const { data: chatMessages, isLoading: chatLoading, error: chatError, refetch: refetchChat } = useQuery([
    "groupChat",
    groupId,
  ], async () => {
    const res = await groupChatAPI.getMessages(groupId!);
    return res.data;
  }, { enabled: !!groupId });

  // Assume user role is available (replace with real user/role logic)
  const isAdmin = group?.members?.find((m: Member) => m.role === "Admin")?.email === localStorage.getItem("userEmail");

  // Remove member mutation (optimistic UI)
  const removeMemberMutation = useMutation(
    async (email: string) => {
      const member = group?.members.find((m: Member) => m.email === email);
      if (!member) throw new Error("Member not found");
      await groupsAPI.removeMember(groupId!, member.email);
      return email;
    },
    {
      onMutate: async (email) => {
        // Optimistically update group members
        await queryClient.cancelQueries(["groupDetails", groupId]);
        const prevGroup = queryClient.getQueryData(["groupDetails", groupId]);
        if (prevGroup && (prevGroup as any).members) {
          queryClient.setQueryData(["groupDetails", groupId], {
            ...(prevGroup as any),
            members: (prevGroup as any).members.filter((m: Member) => m.email !== email),
          });
        }
        return { prevGroup };
      },
      onError: (err: any, _email, context: any) => {
        setToast({ message: err?.message || "Failed to remove member", type: "error" });
        if (context?.prevGroup) {
          queryClient.setQueryData(["groupDetails", groupId], context.prevGroup);
        }
      },
      onSuccess: () => {
        setToast({ message: "Member removed successfully", type: "success" });
        queryClient.invalidateQueries(["groupDetails", groupId]);
      },
    }
  );

  // Send chat message mutation (optimistic UI)
  const sendMessageMutation = useMutation(
    async (content: string) => {
      await groupChatAPI.sendMessage(groupId!, content);
      return content;
    },
    {
      onMutate: async (content) => {
        await queryClient.cancelQueries(["groupChat", groupId]);
        const prevChat = queryClient.getQueryData(["groupChat", groupId]);
        if (prevChat) {
          queryClient.setQueryData(["groupChat", groupId], [
            ...(prevChat as ChatMessage[]),
            { sender: "You", text: content, time: new Date().toLocaleTimeString() },
          ]);
        }
        return { prevChat };
      },
      onError: (err: any, _content, context: any) => {
        setToast({ message: err?.message || "Failed to send message", type: "error" });
        if (context?.prevChat) {
          queryClient.setQueryData(["groupChat", groupId], context.prevChat);
        }
      },
      onSuccess: () => {
        setToast({ message: "Message sent", type: "success" });
        refetchChat();
      },
    }
  );

  // Local state for chat input and confirmation dialog
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showConfirm, setShowConfirm] = useState<{ open: boolean; email: string | null }>({ open: false, email: null });

  // Simulate typing indicator (for demo)
  React.useEffect(() => {
    if (message) {
      setIsTyping(true);
      const timeout = setTimeout(() => setIsTyping(false), 1200);
      return () => clearTimeout(timeout);
    } else {
      setIsTyping(false);
    }
  }, [message]);

  // Remove member handler with confirmation
  const handleRemoveMember = (email: string) => {
    setShowConfirm({ open: true, email });
  };
  const confirmRemove = () => {
    if (showConfirm.email) {
      removeMemberMutation.mutate(showConfirm.email);
    }
    setShowConfirm({ open: false, email: null });
  };

  // Event card click handler
  const handleEventClick = (eventId: number) => {
    alert(`Open event details for event ID: ${eventId}`);
  };

  // Chat send handler
  const handleSend = () => {
    if (message.trim()) {
      sendMessageMutation.mutate(message);
      setMessage("");
    }
  };

  if (groupLoading || eventsLoading || chatLoading) return <div className="text-center text-slate-300 mt-10">Loading group details...</div>;
  if (groupError || !group) return <div className="text-center text-red-400 mt-10">Failed to load group details.</div>;

  const gridCols = "grid-cols-1 sm:grid-cols-2 md:grid-cols-3";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white p-2 sm:p-4 md:p-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <GroupHeader group={group} />
      {isAdmin && (
        <div className="flex justify-end mb-4">
          <button
            className="bg-blue-700 hover:bg-blue-800 text-white font-medium rounded-md px-4 py-2 text-sm shadow transition"
            onClick={() => setSettingsOpen(true)}
          >
            Edit Group Settings
          </button>
        </div>
      )}
            {/* Group Settings Modal */}
            <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} maxWidth="sm" fullWidth>
              <form onSubmit={handleSettingsSubmit}>
                <DialogTitle>Edit Group Settings</DialogTitle>
                <DialogContent>
                  <TextField
                    label="Group Name"
                    name="name"
                    value={settingsForm.name}
                    onChange={handleSettingsChange}
                    required
                    fullWidth
                    margin="normal"
                  />
                  <TextField
                    label="Description"
                    name="description"
                    value={settingsForm.description}
                    onChange={handleSettingsChange}
                    fullWidth
                    margin="normal"
                    multiline
                    rows={3}
                  />
                  <TextField
                    select
                    label="Privacy"
                    name="privacy"
                    value={settingsForm.privacy}
                    onChange={handleSettingsChange}
                    fullWidth
                    margin="normal"
                  >
                    <MenuItem value="public">Public</MenuItem>
                    <MenuItem value="private">Private</MenuItem>
                  </TextField>
                </DialogContent>
                <DialogActions>
                  <Button onClick={() => setSettingsOpen(false)} color="secondary">Cancel</Button>
                  <Button type="submit" variant="contained" color="primary" disabled={updateGroupMutation.isLoading}>
                    Save Changes
                  </Button>
                </DialogActions>
              </form>
            </Dialog>
      <div className={`grid ${gridCols} gap-6`}>
        <MemberList members={group.members} onRemove={isAdmin ? handleRemoveMember : undefined} />
        <EventList
          events={events || []}
          onEventClick={handleEventClick}
          onCreate={isAdmin ? () => { setEditEvent(null); setEventModalOpen(true); } : undefined}
          onEdit={isAdmin ? (event) => { setEditEvent(event); setEventModalOpen(true); } : undefined}
          onDelete={isAdmin ? (event) => deleteEventMutation.mutate(event.id) : undefined}
          isAdmin={isAdmin}
        />
        <ChatBox chat={chatMessages || []} message={message} setMessage={setMessage} onSend={handleSend} isTyping={isTyping} />
      </div>
      {/* Event create/edit modal */}
      <EventFormModal
        open={eventModalOpen}
        onClose={() => { setEventModalOpen(false); refetchEvents(); }}
        initialData={editEvent}
        groupId={groupId}
      />
      {/* Confirmation Dialog */}
      {showConfirm.open && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <div className="bg-slate-800 p-6 rounded shadow-lg w-80 text-center">
            <div className="mb-4 text-lg">Remove this member?</div>
            <div className="mb-6 text-slate-400">Are you sure you want to remove <span className="font-bold">{showConfirm.email}</span> from the group?</div>
            <div className="flex gap-4 justify-center">
              <button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded" onClick={confirmRemove} disabled={removeMemberMutation.isLoading}>Remove</button>
              <button className="bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded" onClick={() => setShowConfirm({ open: false, email: null })}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function GroupDetailsPage() {
  // API integration (React Query)
  const { data: group, isLoading, error, refetch } = useQuery<Group>({
    queryKey: ["groupDetails"],
    queryFn: fetchGroup,
  });

  // Local state for chat and message
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [showConfirm, setShowConfirm] = useState<{ open: boolean; email: string | null }>({ open: false, email: null });

  // Sync chat with group data
  useEffect(() => {
    if (group) setChat(group.chat);
  }, [group]);

  // Simulate typing indicator (for demo)
  useEffect(() => {
    if (message) {
      setIsTyping(true);
      const timeout = setTimeout(() => setIsTyping(false), 1200);
      return () => clearTimeout(timeout);
    } else {
      setIsTyping(false);
    }
  }, [message]);

  // Remove member handler with confirmation
  const handleRemoveMember = (email: string) => {
    setShowConfirm({ open: true, email });
  };
  const confirmRemove = () => {
    // TODO: API call to remove member
    // For demo, just refetch
    setShowConfirm({ open: false, email: null });
    refetch();
  };

  // Event card click handler
  const handleEventClick = (eventId: number) => {
    alert(`Open event details for event ID: ${eventId}`);
  };

  // Chat send handler
  const handleSend = () => {
    if (message.trim()) {
      setChat([
        ...chat,
        { sender: "You", text: message, time: new Date().toLocaleTimeString() },
      ]);
      setMessage("");
    }
  };

  if (isLoading) return <div className="text-center text-slate-300 mt-10">Loading group details...</div>;
  if (error || !group) return <div className="text-center text-red-400 mt-10">Failed to load group details.</div>;

  const gridCols = "grid-cols-1 sm:grid-cols-2 md:grid-cols-3";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white p-2 sm:p-4 md:p-6">
      <GroupHeader group={group} />
      <div className={`grid ${gridCols} gap-6`}>
        <MemberList members={group.members} onRemove={handleRemoveMember} />
        <EventList events={group.events} onEventClick={handleEventClick} />
        <ChatBox chat={chat} message={message} setMessage={setMessage} onSend={handleSend} isTyping={isTyping} />
      </div>
      {/* Confirmation Dialog */}
      {showConfirm.open && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <div className="bg-slate-800 p-6 rounded shadow-lg w-80 text-center">
            <div className="mb-4 text-lg">Remove this member?</div>
            <div className="mb-6 text-slate-400">Are you sure you want to remove <span className="font-bold">{showConfirm.email}</span> from the group?</div>
            <div className="flex gap-4 justify-center">
              <button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded" onClick={confirmRemove}>Remove</button>

              <button className="bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded" onClick={() => setShowConfirm({ open: false, email: null })}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a2233] to-[#232946] p-6 font-sans text-white">
      {/* Feedback/Alert (success or error) - below navbar, above content */}
      {(success || error) && showAlert && (
        <div className={`max-w-2xl mx-auto mt-2 flex items-center justify-between px-4 py-3 rounded shadow-lg ${success ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}
             style={{ position: 'relative', zIndex: 20 }}>
          <span>{t(success || error)}</span>
          <button onClick={() => setShowAlert(false)} className="ml-4 text-lg font-bold focus:outline-none">×</button>
        </div>
      )}
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mt-2">
        {/* Group Info */}
        <div className="md:col-span-3">
          <div className="bg-[#232946] rounded-xl shadow-md p-6 flex flex-col md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold mb-1 flex items-center gap-3">
                  {group.name}
                  <Tooltip title={t('groupDetails.pendingJoinRequests')} placement="top">
                    <span>
                      <Badge
                        color="error"
                        badgeContent={group.pendingJoinRequests || 0}
                        invisible={!group.pendingJoinRequests}
                        overlap="circular"
                        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                      >
                        <IconButton
                          size="small"
                          sx={{ p: 0, bgcolor: 'transparent', '&:hover': { bgcolor: 'rgba(58,134,255,0.08)' } }}
                        >
                          <UsersIcon className="w-7 h-7 text-blue-400" />
                        </IconButton>
                      </Badge>
                      <JoinRequestsPopover groupId={group.id} />
                    </span>
                  </Tooltip>
                </h1>
              </div>
              {/* Group Details Section */}
              <div className="text-[#a1a6b4] text-sm mt-1">
                {group.description && <div>{group.description}</div>}
                {group.createdBy && group.createdAt && (
                  <div>{t('groupDetails.createdBy', { name: group.createdBy.name, date: new Date(group.createdAt).toLocaleDateString() })}</div>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-4 md:mt-0">
              {/* Copy Link (link icon) */}
              <button title={t('groupDetails.inviteLinkCopied')} onClick={handleCopyInviteLink} className="border border-blue-500 text-blue-500 bg-transparent rounded-md p-2 flex items-center justify-center hover:bg-blue-900/20 transition">
                <LinkIcon className="w-5 h-5" />
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
              {/* Arrow (navigate/forward) - removed for cleaner UI */}
              {/* Event Request Button (only for non-admins, under action buttons) */}
              {!isAdmin && (
                <button
                  onClick={() => navigate(`/event-requests/${id}/new`)}
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold rounded-md px-4 py-2 text-base shadow-md transition flex items-center justify-center gap-2 mt-2"
                  style={{ minWidth: '180px', maxWidth: '220px' }}
                >
                  <AlertCircleIcon className="w-5 h-5" />
                  {t('eventRequests.createRequest')}
                </button>
              )}
            </div>
          </div>
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
    </div>

export default GroupDetailsPage;
