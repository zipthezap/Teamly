import React, { useState } from "react";
import AdminTransferDialog from "../components/GroupDetails/AdminTransferDialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField } from '@mui/material';
import GroupSettingsModal from "../components/common/GroupSettingsModal";
import { useAuth } from "../contexts/AuthContext";
import GroupHeader from "../components/GroupDetails/GroupHeader";
import GroupStats from "../components/GroupDetails/GroupStats";
import MemberList from "../components/GroupDetails/MemberList";
import EventList from "../components/GroupDetails/EventList";
import EventFormModal from "../components/event/EventFormModal";
import ChatBox from "../components/GroupDetails/ChatBox";
import { GroupWithDetails, GroupMember, ChatMessage } from "../types/group";
import { groupsAPI, eventsAPI, groupChatAPI } from "../services/api";
import { EventWithDetails, UpdateGroupData } from "../../../shared/types";
import { AxiosError } from "axios";
import { getErrorMessage } from "../utils/errorHandler";

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
  const { user } = useAuth();
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<EventWithDetails | undefined>(undefined);
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
  const [groupPicture, setGroupPicture] = useState<string | undefined>();

  // Fetch group details
  const { data: group, isLoading: groupLoading, error: groupError } = useQuery({
    queryKey: ["groupDetails", groupId],
    queryFn: async () => {
      const res = await groupsAPI.getById(groupId!);
      return res.data as GroupWithDetails;
    },
    enabled: !!groupId,
  });

  // Fetch events for this group
  const { data: events, isLoading: eventsLoading, refetch: refetchEvents } = useQuery({
    queryKey: ["groupEvents", groupId],
    queryFn: async () => {
      const res = await eventsAPI.getAll({ groupId });
      console.log('[GroupDetailsPage] API events response:', res.data);
      return res.data;
    },
    enabled: !!groupId,
  });

  // Fetch chat messages for this group
  const { data: chatMessages, isLoading: chatLoading } = useQuery({
    queryKey: ["groupChat", groupId],
    queryFn: async () => {
      const res = await groupChatAPI.getMessages(groupId!);
      return res.data;
    },
    enabled: !!groupId,
  });

  // Improved admin check: use AuthContext for user email
  const userEmail = user?.email || null;

  // Fallback: if member emails are missing, check if user is group creator
  let isAdmin = false;
  if (group?.members?.some((m: GroupMember) => m.role && user && m.userId === user.id && m.role === "admin")) {
    isAdmin = true;
  } else if ((!group?.members || group.members.length === 0) && group?.creator?.email && userEmail) {
    isAdmin = group.creator.email === userEmail;
  }

  // Check if user is a moderator or admin (can edit but not delete)
  const canEdit = group?.members?.some((m: GroupMember) => user && m.userId === user.id && (m.role === "admin" || m.role === "moderator"));

  // Check if user is a member of the group
  const isMember = group?.members?.some((m: GroupMember) => user && m.userId === user.id);

  // Update group settings when group data loads
  React.useEffect(() => {
    if (group) {
      setSettingsForm({
        name: group.name || '',
        description: group.description || '',
        privacy: group.isPublic ? 'public' : 'private',
      });
      setGroupPicture(group.picture ?? undefined);
    }
  }, [group]);

  // Update group mutation
  const updateGroupMutation = useMutation({
    mutationFn: async (data: UpdateGroupData) => {
      await groupsAPI.update(groupId!, data);
      return data;
    },
    onSuccess: () => {
      setToast({ message: t('groupDetails.groupUpdated'), type: "success" });
      queryClient.invalidateQueries({ queryKey: ["groupDetails", groupId] });
      setSettingsOpen(false);
    },
    onError: (err: unknown) => {
      const errorMessage = err instanceof Error ? err.message : t('groupDetails.failedToUpdateGroup');
      setToast({ message: errorMessage, type: "error" });
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
    onError: (err: unknown) => {
      const errorMessage = err instanceof Error ? err.message : t('groupDetails.failedToDeleteEvent');
      setToast({ message: errorMessage, type: "error" });
    },
  });

  // Remove member mutation (optimistic UI)
  const removeMemberMutation = useMutation({
    mutationFn: async (email: string) => {
      const member = group?.members?.find((m: GroupMember) => m.userId === email);
      if (!member) throw new Error("Member not found");
      await groupsAPI.removeMember(groupId!, member.userId);
      return email;
    },
    onMutate: async (email) => {
      // Optimistically update group members
      await queryClient.cancelQueries({ queryKey: ["groupDetails", groupId] });
      const prevGroup = queryClient.getQueryData(["groupDetails", groupId]);
      const membersArray = (prevGroup as GroupWithDetails)?.members || [];
      if (prevGroup) {
        queryClient.setQueryData(["groupDetails", groupId], {
          ...(prevGroup as GroupWithDetails),
          members: membersArray.filter((m: GroupMember) => m.userId !== email),
        });
      }
      return { prevGroup };
    },
    onError: (err: unknown, _email, context: { prevGroup?: unknown } | undefined) => {
      const errorMessage = err instanceof Error ? err.message : t('groupDetails.failedToRemove');
      setToast({ message: errorMessage, type: "error" });
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
    onError: (err: unknown, _content, context: { prevChat?: unknown } | undefined) => {
      const errorMessage = err instanceof Error ? err.message : t('groupDetails.failedToSendMessage');
      setToast({ message: errorMessage, type: "error" });
      if (context?.prevChat) {
        queryClient.setQueryData(["groupChat", groupId], context.prevChat);
      }
    },
    onSuccess: () => {
      setToast({ message: t('groupDetails.messageSent'), type: "success" });
      queryClient.invalidateQueries({ queryKey: ["groupChat", groupId] });
    },
  });

  // Local state for chat input, confirmation dialog, and join requests
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showConfirm, setShowConfirm] = useState<{ open: boolean; email: string | null }>({ open: false, email: null });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showAdminTransfer, setShowAdminTransfer] = useState(false);
  const [selectedNewAdmin, setSelectedNewAdmin] = useState<string>("");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");

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
    let timeout: NodeJS.Timeout | undefined;
    if (message) {
      setIsTyping(true);
      timeout = setTimeout(() => setIsTyping(false), 1200);
    } else {
      setIsTyping(false);
    }
    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
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
  const navigate = useNavigate();
  const handleEventClick = (eventId: string) => {
    navigate(`/events/${eventId}`);
  };

  // Chat send handler
  const handleSend = () => {
    if (message.trim()) {
      sendMessageMutation.mutate(message);
      setMessage("");
    }
  };

  // Delete group handler
  const deleteGroupMutation = useMutation({
    mutationFn: async () => {
      await groupsAPI.delete(groupId!);
    },
    onSuccess: () => {
      setToast({ message: t('groupDetails.groupDeleted'), type: "success" });
      setTimeout(() => {
        navigate('/groups');
      }, 1000);
    },
    onError: (err: unknown) => {
      setToast({ message: getErrorMessage(err) || t('groupDetails.failedToDelete'), type: "error" });
    },
  });

  const handleDeleteGroup = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDeleteGroup = () => {
    deleteGroupMutation.mutate();
    setShowDeleteConfirm(false);
  };

  // Leave group handler
  const leaveGroupMutation = useMutation({
    mutationFn: async () => {
      await groupsAPI.leave(groupId!);
    },
    onSuccess: () => {
      setToast({ message: t('groupDetails.leftGroup'), type: "success" });
      setTimeout(() => {
        navigate('/groups');
      }, 1000);
    },
    onError: (err: unknown) => {
      setToast({ message: getErrorMessage(err) || t('groupDetails.failedToLeave'), type: "error" });
    },
  });

  // Admin leave logic: require transfer
  const handleLeaveGroup = () => {
    const membersArray = Array.isArray(group?.members) ? group.members : [];
    if (isAdmin && membersArray.filter((m: GroupMember) => m.role !== "admin").length > 0) {
      setShowAdminTransfer(true);
    } else {
      setShowLeaveConfirm(true);
    }
  };

  // Transfer admin and leave group
  const confirmAdminTransfer = async () => {
    if (!selectedNewAdmin) return;
    try {
      await groupsAPI.transferAdmin(groupId!, selectedNewAdmin); // Assumes backend API exists
      await groupsAPI.leave(groupId!);
      setToast({ message: t('groupDetails.leftGroup'), type: "success" });
      setShowAdminTransfer(false);
      setTimeout(() => {
        navigate('/groups');
      }, 1000);
    } catch (err: unknown) {
      const errorMessage = err instanceof AxiosError 
        ? err.response?.data?.error || t('groupDetails.failedToLeave')
        : t('groupDetails.failedToLeave');
      setToast({ message: errorMessage, type: "error" });
    }
  };

  // Regular leave for non-admins or if no other members
  const confirmLeaveGroup = () => {
    leaveGroupMutation.mutate();
    setShowLeaveConfirm(false);
  };

  // Invite member handler
  const inviteMemberMutation = useMutation({
    mutationFn: async (email: string) => {
      await groupsAPI.invite(groupId!, email);
    },
    onSuccess: () => {
      setToast({ message: t('groupDetails.memberInvited'), type: "success" });
      setShowInviteModal(false);
      setInviteEmail("");
      queryClient.invalidateQueries({ queryKey: ["groupDetails", groupId] });
    },
    onError: (err: unknown) => {
      const errorMessage = err instanceof AxiosError 
        ? err.response?.data?.error || t('groupDetails.failedToInvite')
        : t('groupDetails.failedToInvite');
      setToast({ message: errorMessage, type: "error" });
    },
  });

  const handleInviteMember = () => {
    setShowInviteModal(true);
  };

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inviteEmail.trim()) {
      inviteMemberMutation.mutate(inviteEmail);
    }
  };

  // Copy invite link handler (direct join, no pending request)
  const handleCopyLink = async () => {
    try {
      const res = await groupsAPI.getInviteLink(groupId!);
      const inviteLink = `${window.location.origin}/join-group/${res.data.groupId}`;
      await navigator.clipboard.writeText(inviteLink);
      setToast({ message: `${t('groupDetails.inviteLinkCopied')}\n${t('groupDetails.inviteLinkInstructions')}` , type: "success" });
    } catch (err: unknown) {
      const errorMessage = err instanceof AxiosError 
        ? err.response?.data?.error || t('groupDetails.failedToGetInviteLink')
        : t('groupDetails.failedToGetInviteLink');
      setToast({ message: errorMessage, type: "error" });
    }
  };

  // Picture upload handler
  const handlePictureUpload = async (file: File) => {
    try {
      const response = await groupsAPI.uploadGroupPicture(groupId!, file);
      setGroupPicture(response.data.group.picture);
      setToast({ message: t('groupDetails.groupPictureUpdated') || 'Group picture updated successfully', type: "success" });
      queryClient.invalidateQueries({ queryKey: ["groupDetails", groupId] });
    } catch (err: unknown) {
      const errorMessage = err instanceof AxiosError 
        ? err.response?.data?.error || t('groupDetails.failedToUploadPicture') || 'Failed to upload group picture'
        : t('groupDetails.failedToUploadPicture') || 'Failed to upload group picture';
      setToast({ message: errorMessage, type: "error" });
      throw err;
    }
  };

  // Picture delete handler
  const handleDeletePicture = async () => {
    try {
      const response = await groupsAPI.deleteGroupPicture(groupId!);
      setGroupPicture(response.data.group.picture ?? undefined);
      setToast({ message: t('groupDetails.groupPictureDeleted') || 'Group picture deleted successfully', type: "success" });
      queryClient.invalidateQueries({ queryKey: ["groupDetails", groupId] });
    } catch (err: unknown) {
      const errorMessage = err instanceof AxiosError 
        ? err.response?.data?.error || t('groupDetails.failedToDeletePicture') || 'Failed to delete group picture'
        : t('groupDetails.failedToDeletePicture') || 'Failed to delete group picture';
      setToast({ message: errorMessage, type: "error" });
      throw err;
    }
  };

  if (groupLoading || eventsLoading || chatLoading) return <div className="text-center text-slate-300 mt-10">{t('groupDetails.loadingGroupDetails')}</div>;
  if (groupError || !group) return <div className="text-center text-red-400 mt-10">{t('groupDetails.failedToLoad')}</div>;

  const gridCols = "grid-cols-1 sm:grid-cols-2 md:grid-cols-3";
  const eventsArray = Array.isArray(events) ? events : (events?.data ?? []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white p-2 sm:p-4 md:p-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <GroupHeader
        group={group}
        onEdit={isAdmin ? (() => setSettingsOpen(true)) : undefined}
        onDelete={isAdmin ? handleDeleteGroup : undefined}
        onLeave={isMember ? handleLeaveGroup : undefined}
        onInvite={isMember ? handleInviteMember : undefined}
        onCopyLink={isMember ? handleCopyLink : undefined}
        isAdmin={isAdmin}
      />
      {/* Group Statistics */}
      <GroupStats memberCount={group.members?.length || 0} events={eventsArray} />
      {/* Group Settings Modal (shared component) */}
      <GroupSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSubmit={() => updateGroupMutation.mutate(settingsForm)}
        form={settingsForm}
        setForm={setSettingsForm}
        groupPicture={groupPicture}
        onPictureUpload={handlePictureUpload}
        onPictureDelete={handleDeletePicture}
        isSubmitting={updateGroupMutation.isPending}
        t={t}
      />
      <div className={`grid ${gridCols} gap-6`}>
        <MemberList members={group.members as GroupMember[]} onRemove={isAdmin ? handleRemoveMember : undefined} />
        <EventList
          events={eventsArray}
          onEventClick={handleEventClick}
          onCreate={isMember ? () => { setEditEvent(undefined); setEventModalOpen(true); } : undefined}
          isAdmin={isAdmin}
          groupId={groupId}
          isMember={isMember}
        />
        <ChatBox chat={chatMessages || []} message={message} setMessage={setMessage} onSend={handleSend} isTyping={isTyping} />
      </div>
      {/* Event create/edit modal */}
      <EventFormModal
        open={eventModalOpen}
        onClose={() => setEventModalOpen(false)}
        onSuccess={() => refetchEvents()}
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
      {/* Delete Group Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <div className="bg-slate-800 p-6 rounded shadow-lg w-96 text-center">
            <div className="mb-4 text-lg font-bold">{t('groupDetails.deleteGroup')}?</div>
            <div className="mb-6 text-slate-400">
              {t('groupDetails.confirmDelete')}
            </div>
            <div className="flex gap-4 justify-center">
              <button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded" onClick={confirmDeleteGroup} disabled={deleteGroupMutation.isPending}>{t('common.delete')}</button>
              <button className="bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded" onClick={() => setShowDeleteConfirm(false)}>{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}
      {/* Admin Transfer Dialog */}
      <AdminTransferDialog
        open={showAdminTransfer}
        members={
          (group?.members || []).map(m => ({
            email: m.user?.email || '',
            name: m.user?.name || '',
            role: m.role
          }))
        }
        selectedNewAdmin={selectedNewAdmin}
        onSelect={setSelectedNewAdmin}
        onConfirm={confirmAdminTransfer}
        onCancel={() => setShowAdminTransfer(false)}
        confirmDisabled={false}
      />
      {/* Leave Group Confirmation Dialog */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <div className="bg-slate-800 p-6 rounded shadow-lg w-96 text-center">
            <div className="mb-4 text-lg font-bold">{t('groupDetails.leave')}?</div>
            <div className="mb-6 text-slate-400">
              {t('groupDetails.confirmLeave')}
            </div>
            <div className="flex gap-4 justify-center">
              <button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded" onClick={confirmLeaveGroup} disabled={leaveGroupMutation.isPending}>{t('groupDetails.leave')}</button>
              <button className="bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded" onClick={() => setShowLeaveConfirm(false)}>{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}
      {/* Invite Member Modal */}
      <Dialog open={showInviteModal} onClose={() => setShowInviteModal(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleInviteSubmit}>
          <DialogTitle>{t('groupDetails.inviteMember')}</DialogTitle>
          <DialogContent>
            <TextField
              label={t('common.email')}
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
              fullWidth
              margin="normal"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowInviteModal(false)} color="secondary">{t('common.cancel')}</Button>
            <Button type="submit" variant="contained" color="primary" disabled={inviteMemberMutation.isPending}>
              {t('groupDetails.invite')}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </div>
  );
}
