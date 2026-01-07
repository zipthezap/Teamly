import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem } from '@mui/material';
import GroupHeader from "../components/GroupDetails/GroupHeader";
import GroupStats from "../components/GroupDetails/GroupStats";
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
  const { t } = useTranslation();
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<any>(null);
  const { id: groupId } = useParams();
  const queryClient = useQueryClient();

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Group settings state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    name: '',
    description: '',
    privacy: 'public',
  });

  // Fetch group details
  const { data: group, isLoading: groupLoading, error: groupError } = useQuery({
    queryKey: ["groupDetails", groupId],
    queryFn: async () => {
      const res = await groupsAPI.getById(groupId!);
      return res.data;
    },
    enabled: !!groupId,
  });

  // Fetch events for this group
  const { data: events, isLoading: eventsLoading, error: eventsError, refetch: refetchEvents } = useQuery({
    queryKey: ["groupEvents", groupId],
    queryFn: async () => {
      const res = await eventsAPI.getAll({ groupId });
      return res.data;
    },
    enabled: !!groupId,
  });

  // Fetch chat messages for this group
  const { data: chatMessages, isLoading: chatLoading, error: chatError, refetch: refetchChat } = useQuery({
    queryKey: ["groupChat", groupId],
    queryFn: async () => {
      const res = await groupChatAPI.getMessages(groupId!);
      return res.data;
    },
    enabled: !!groupId,
  });

  // Assume user role is available (replace with real user/role logic)
  const isAdmin = group?.members?.find((m: Member) => m.role === "Admin")?.email === localStorage.getItem("userEmail");

  // Update group settings when group data loads
  React.useEffect(() => {
    if (group) {
      setSettingsForm({
        name: group.name || '',
        description: group.description || '',
        privacy: group.privacy || 'public',
      });
    }
  }, [group]);

  // Update group mutation
  const updateGroupMutation = useMutation({
    mutationFn: async (data: any) => {
      await groupsAPI.update(groupId!, data);
      return data;
    },
    onSuccess: () => {
      setToast({ message: t('groupDetails.groupUpdated'), type: "success" });
      queryClient.invalidateQueries({ queryKey: ["groupDetails", groupId] });
      setSettingsOpen(false);
    },
    onError: (err: any) => {
      setToast({ message: err?.message || t('groupDetails.failedToUpdateGroup'), type: "error" });
    },
  });

  // Delete event mutation
  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: number) => {
      await eventsAPI.delete(eventId);
      return eventId;
    },
    onSuccess: () => {
      setToast({ message: t('groupDetails.eventDeleted'), type: "success" });
      queryClient.invalidateQueries({ queryKey: ["groupEvents", groupId] });
    },
    onError: (err: any) => {
      setToast({ message: err?.message || t('groupDetails.failedToDeleteEvent'), type: "error" });
    },
  });

  // Remove member mutation (optimistic UI)
  const removeMemberMutation = useMutation({
    mutationFn: async (email: string) => {
      const member = group?.members.find((m: Member) => m.email === email);
      if (!member) throw new Error("Member not found");
      await groupsAPI.removeMember(groupId!, member.email);
      return email;
    },
    onMutate: async (email) => {
      // Optimistically update group members
      await queryClient.cancelQueries({ queryKey: ["groupDetails", groupId] });
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
      setToast({ message: err?.message || t('groupDetails.failedToRemove'), type: "error" });
      if (context?.prevGroup) {
        queryClient.setQueryData(["groupDetails", groupId], context.prevGroup);
      }
    },
    onSuccess: () => {
      setToast({ message: t('groupDetails.memberRemoved'), type: "success" });
      queryClient.invalidateQueries({ queryKey: ["groupDetails", groupId] });
    },
  });

  // Send chat message mutation (optimistic UI)
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      await groupChatAPI.sendMessage(groupId!, content);
      return content;
    },
    onMutate: async (content) => {
      await queryClient.cancelQueries({ queryKey: ["groupChat", groupId] });
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
      setToast({ message: err?.message || t('groupDetails.failedToSendMessage'), type: "error" });
      if (context?.prevChat) {
        queryClient.setQueryData(["groupChat", groupId], context.prevChat);
      }
    },
    onSuccess: () => {
      setToast({ message: t('groupDetails.messageSent'), type: "success" });
      queryClient.invalidateQueries({ queryKey: ["groupChat", groupId] });
    },
  });

  // Local state for chat input and confirmation dialog
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showConfirm, setShowConfirm] = useState<{ open: boolean; email: string | null }>({ open: false, email: null });

  // Handle settings form change
  const handleSettingsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettingsForm({ ...settingsForm, [e.target.name]: e.target.value });
  };

  // Handle settings form submit
  const handleSettingsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateGroupMutation.mutate(settingsForm);
  };

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
    alert(`${t('common.viewDetails')} ${eventId}`);
  };

  // Chat send handler
  const handleSend = () => {
    if (message.trim()) {
      sendMessageMutation.mutate(message);
      setMessage("");
    }
  };

  if (groupLoading || eventsLoading || chatLoading) return <div className="text-center text-slate-300 mt-10">{t('groupDetails.loadingGroupDetails')}</div>;
  if (groupError || !group) return <div className="text-center text-red-400 mt-10">{t('groupDetails.failedToLoad')}</div>;

  const gridCols = "grid-cols-1 sm:grid-cols-2 md:grid-cols-3";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white p-2 sm:p-4 md:p-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <GroupHeader 
        group={group} 
        onEdit={isAdmin ? () => setSettingsOpen(true) : undefined}
        isAdmin={isAdmin}
      />
      {/* Group Statistics */}
      <GroupStats memberCount={group.members?.length || 0} events={events || []} />
      {/* Group Settings Modal */}
      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSettingsSubmit}>
          <DialogTitle>{t('groupDetails.editGroupSettings')}</DialogTitle>
          <DialogContent>
            <TextField
              label={t('groupDetails.groupName')}
              name="name"
              value={settingsForm.name}
              onChange={handleSettingsChange}
              required
              fullWidth
              margin="normal"
            />
            <TextField
              label={t('groupDetails.description')}
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
              label={t('groupDetails.privacy')}
              name="privacy"
              value={settingsForm.privacy}
              onChange={handleSettingsChange}
              fullWidth
              margin="normal"
            >
              <MenuItem value="public">{t('groups.public')}</MenuItem>
              <MenuItem value="private">{t('groups.private')}</MenuItem>
            </TextField>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSettingsOpen(false)} color="secondary">{t('common.cancel')}</Button>
            <Button type="submit" variant="contained" color="primary" disabled={updateGroupMutation.isPending}>
              {t('groupDetails.saveChanges')}
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
        onClose={() => setEventModalOpen(false)}
        initialData={editEvent}
        groupId={groupId}
      />
      {/* Confirmation Dialog */}
      {showConfirm.open && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <div className="bg-slate-800 p-6 rounded shadow-lg w-80 text-center">
            <div className="mb-4 text-lg">{t('groupDetails.removeThisMember')}</div>
            <div className="mb-6 text-slate-400">
              {t('groupDetails.confirmRemoveMemberDesc', { email: showConfirm.email })}
            </div>
            <div className="flex gap-4 justify-center">
              <button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded" onClick={confirmRemove} disabled={removeMemberMutation.isPending}>{t('groupDetails.remove')}</button>
              <button className="bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded" onClick={() => setShowConfirm({ open: false, email: null })}>{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
