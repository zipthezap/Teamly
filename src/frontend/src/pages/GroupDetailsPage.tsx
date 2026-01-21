import React, { useState, useCallback } from "react";
import AdminTransferDialog from "../components/GroupDetails/AdminTransferDialog";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Box, Container, Snackbar, Alert } from '@mui/material';
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
import { useNotification } from "../hooks/useNotification";
import { useApiMutation } from "../hooks/useApiMutation";
import { usePermissions } from "../hooks/usePermissions";
import ConfirmationDialog from "../components/common/ConfirmationDialog";

export default function GroupDetailsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { notification, showSuccess, showError, hideNotification } = useNotification();
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<EventWithDetails | undefined>(undefined);
  const { id: groupId } = useParams();
  const queryClient = useQueryClient();

  // Group settings state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    name: '',
    description: '',
    privacy: 'public',
    sportType: '' as string | undefined,
    maxMembers: '' as number | string | undefined,
    autoApproveJoinRequests: false,
    tags: '' as string | undefined,
    allowMemberInvites: false,
    allowMemberCopyLink: true,
  });
  const [groupPicture, setGroupPicture] = useState<string | undefined>();



  // Fetch group details (with members)
  const { data: group, isLoading: groupLoading, error: groupError, refetch: _refetchGroup } = useQuery({
    queryKey: ["groupDetails", groupId],
    queryFn: async () => {
      const res = await groupsAPI.getById(groupId!);
      return res.data as GroupWithDetails;
    },
    enabled: !!groupId,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // Use group.members for MemberList
  const members = Array.isArray(group?.members) ? group.members : [];

  // Use permissions hook for centralized permission checking
  const currentMember = members.find((m: GroupMember) => m.id === user?.id);
  const { isAdmin, isModerator, isMember, canEdit, canManageMembers } = usePermissions({
    resourceType: 'group',
    creatorId: group?.creatorId,
    userRole: currentMember?.role,
    groupMembers: members,
  });

  // Check if user can invite members
  const canInvite = group && user ? 
    (canEdit || (isMember && group.allowMemberInvites)) : false;

  // Check if user can copy invite link (only for public groups)
  const canCopyLink = group && user && group.isPublic && (canEdit || (isMember && group.allowMemberCopyLink));

  // Fetch events for this group
  const { data: events, isLoading: eventsLoading, refetch: refetchEvents } = useQuery({
    queryKey: ["groupEvents", groupId],
    queryFn: async () => {
      const res = await eventsAPI.getAll({ groupId });
      return res.data;
    },
    enabled: !!groupId,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // Fetch chat messages for this group
  const { data: chatMessages, isLoading: chatLoading } = useQuery({
    queryKey: ["groupChat", groupId],
    queryFn: async () => {
      const res = await groupChatAPI.getMessages(groupId!);
      return res.data;
    },
    enabled: !!groupId,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });


  // Update group settings when group data loads
  React.useEffect(() => {
    if (group) {
      setSettingsForm({
        name: group.name || '',
        description: group.description || '',
        privacy: group.isPublic ? 'public' : 'private',
        sportType: group.sportType || '',
        maxMembers: group.maxMembers || '',
        autoApproveJoinRequests: group.autoApproveJoinRequests || false,
        tags: group.tags || '',
        allowMemberInvites: group.allowMemberInvites || false,
        allowMemberCopyLink: group.allowMemberCopyLink !== false,
      });
      setGroupPicture(group.picture ?? undefined);
    }
  }, [group]);

  // Update group mutation
  const updateGroupMutation = useApiMutation({
    mutationFn: async (formData: typeof settingsForm) => {
      // Transform form data to match API expectations
      const data: UpdateGroupData = {
        name: formData.name,
        description: formData.description,
        isPublic: formData.privacy === 'public',
        sportType: formData.sportType,
        maxMembers: formData.maxMembers ? Number(formData.maxMembers) : undefined,
        autoApproveJoinRequests: formData.autoApproveJoinRequests,
        tags: formData.tags,
        allowMemberInvites: formData.allowMemberInvites,
        allowMemberCopyLink: formData.allowMemberCopyLink,
      };
      await groupsAPI.update(groupId!, data);
      return data;
    },
    invalidateKeys: [["groupDetails", groupId]],
    onSuccess: () => {
      showSuccess(t('groupDetails.groupUpdated'));
      setSettingsOpen(false);
    },
    onError: (error) => {
      showError(error || t('groupDetails.failedToUpdateGroup'));
    },
  });

  // Delete event mutation
  const _deleteEventMutation = useApiMutation({
    mutationFn: async (eventId: number) => {
      await eventsAPI.delete(eventId);
      return eventId;
    },
    invalidateKeys: [["groupEvents", groupId], ["groupsList"]],
    onSuccess: () => showSuccess(t('groupDetails.eventDeleted')),
    onError: (error) => showError(error || t('groupDetails.failedToDeleteEvent')),
  });

  // Remove member mutation (optimistic UI)
  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      // Now uses userId instead of groupMemberId
      await groupsAPI.removeMember(groupId!, memberId);
      return memberId;
    },
    onMutate: async (memberId) => {
      // Optimistically update group members
      await queryClient.cancelQueries({ queryKey: ["groupDetails", groupId] });
      const prevGroup = queryClient.getQueryData(["groupDetails", groupId]);
      const membersArray = (prevGroup as GroupWithDetails)?.members || [];
      if (prevGroup) {
        queryClient.setQueryData(["groupDetails", groupId], {
          ...(prevGroup as GroupWithDetails),
          members: membersArray.filter((m: GroupMember) => m.userId !== memberId && m.id !== memberId),
        });
      }
      return { prevGroup };
    },
    onError: (err: unknown, _memberId, context: { prevGroup?: unknown } | undefined) => {
      const errorMessage = err instanceof Error ? err.message : t('groupDetails.failedToRemove');
      showError(errorMessage);
      if (context?.prevGroup) {
        queryClient.setQueryData(["groupDetails", groupId], context.prevGroup);
      }
    },
    onSuccess: () => {
      showSuccess(t('groupDetails.memberRemoved'));
      queryClient.invalidateQueries({ queryKey: ["groupDetails", groupId] });
      queryClient.invalidateQueries({ queryKey: ["groupMembers", groupId] });
      // Invalidate groupsList to update member counts displayed in GroupsList
      queryClient.invalidateQueries({ queryKey: ["groupsList"] });
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
      showError(errorMessage);
      if (context?.prevChat) {
        queryClient.setQueryData(["groupChat", groupId], context.prevChat);
      }
    },
    onSuccess: () => {
      showSuccess(t('groupDetails.messageSent'));
      queryClient.invalidateQueries({ queryKey: ["groupChat", groupId] });
    },
  });

  // Local state for chat input, confirmation dialog, and join requests
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showConfirm, setShowConfirm] = useState<{ open: boolean; memberId: string | null }>({ open: false, memberId: null });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showAdminTransfer, setShowAdminTransfer] = useState(false);
  const [selectedNewAdmin, setSelectedNewAdmin] = useState<string>("");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");

  // Handle settings form change
  const _handleSettingsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettingsForm({ ...settingsForm, [e.target.name]: e.target.value });
  };

  // Handle settings form submit
  const _handleSettingsSubmit = (e: React.FormEvent) => {
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
  const handleRemoveMember = useCallback((memberId: string) => {
    setShowConfirm({ open: true, memberId });
  }, []);

  const confirmRemove = useCallback(() => {
    if (showConfirm.memberId) {
      removeMemberMutation.mutate(showConfirm.memberId);
    }
    setShowConfirm({ open: false, memberId: null });
  }, [showConfirm.memberId, removeMemberMutation]);

  // Event card click handler
  const navigate = useNavigate();
  const handleEventClick = useCallback((eventId: string) => {
    navigate(`/events/${eventId}`);
  }, [navigate]);

  // Chat send handler
  const handleSend = useCallback(() => {
    if (message.trim()) {
      sendMessageMutation.mutate(message);
      setMessage("");
    }
  }, [message, sendMessageMutation]);

  // Delete group handler
  const deleteGroupMutation = useApiMutation({
    mutationFn: async () => {
      await groupsAPI.delete(groupId!);
    },
    invalidateKeys: [["groupsList"], ["groupDetails"], ["groups"]],
    onSuccess: () => {
      showSuccess(t('groupDetails.groupDeleted'));
      // Navigate immediately to groups page - cache invalidation ensures fresh data
      setTimeout(() => {
        navigate('/groups', { state: { justLeftGroup: true } });
      }, 500);
    },
    onError: (error) => {
      showError(error || t('groupDetails.failedToDelete'));
    },
  });

  const handleDeleteGroup = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDeleteGroup = () => {
    deleteGroupMutation.mutate();
    setShowDeleteConfirm(false);
  };

  // Helper function to handle successful leave/delete
  const handleLeaveSuccess = useCallback((groupDeleted: boolean) => {
    // Invalidate all group-related queries to ensure fresh data
    queryClient.invalidateQueries({ queryKey: ["groupsList"] });
    queryClient.invalidateQueries({ queryKey: ["groupDetails"] });
    queryClient.invalidateQueries({ queryKey: ["groups"] });
    
    const message = groupDeleted 
      ? t('groupDetails.groupDeletedAsLastMember', 'Group deleted successfully as you were the last member')
      : t('groupDetails.leftGroup');
    
    showSuccess(message);
    // Navigate immediately to groups page - cache invalidation ensures fresh data
    setTimeout(() => {
      navigate('/groups', { state: { justLeftGroup: true } });
    }, 500);
  }, [queryClient, t, navigate, showSuccess]);

  // Leave group handler
  const leaveGroupMutation = useMutation({
    mutationFn: async () => {
      const response = await groupsAPI.leave(groupId!);
      return response.data;
    },
    onMutate: async () => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: ["groupDetails", groupId] });
      
      // Snapshot the previous value
      const previousGroup = queryClient.getQueryData(["groupDetails", groupId]);
      
      // Optimistically update to remove current user from members
      queryClient.setQueryData(["groupDetails", groupId], (old: GroupWithDetails | undefined) => {
        if (!old || !user) return old;
        return {
          ...old,
          members: old.members?.filter((m: GroupMember) => m.userId !== user.id) || []
        };
      });
      
      // Return context with the snapshot
      return { previousGroup };
    },
    onSuccess: (data) => {
      handleLeaveSuccess(data.groupDeleted);
    },
    onError: (err: unknown, variables, context) => {
      // Rollback on error
      if (context?.previousGroup) {
        queryClient.setQueryData(["groupDetails", groupId], context.previousGroup);
      }
      showError(getErrorMessage(err) || t('groupDetails.failedToLeave'));
    },
  });

  // Check if admin is the only member
  const isOnlyMember = () => {
    const membersArray = Array.isArray(group?.members) ? group.members : [];
    return membersArray.length <= 1;
  };

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
      const response = await groupsAPI.leave(groupId!);
      handleLeaveSuccess(response.data.groupDeleted);
      setShowAdminTransfer(false);
    } catch (err: unknown) {
      const errorMessage = err instanceof AxiosError 
        ? err.response?.data?.error || t('groupDetails.failedToLeave')
        : t('groupDetails.failedToLeave');
      showError(errorMessage);
    }
  };

  // Regular leave for non-admins or if no other members
  const confirmLeaveGroup = () => {
    leaveGroupMutation.mutate();
    setShowLeaveConfirm(false);
  };

  // Invite member handler
  const inviteMemberMutation = useApiMutation({
    mutationFn: async (email: string) => {
      await groupsAPI.invite(groupId!, email);
    },
    invalidateKeys: [["groupDetails", groupId], ["groupsList"]],
    onSuccess: () => {
      showSuccess(t('groupDetails.memberInvited'));
      setShowInviteModal(false);
      setInviteEmail("");
    },
    onError: (error) => {
      showError(error || t('groupDetails.failedToInvite'));
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
      showSuccess(`${t('groupDetails.inviteLinkCopied')}\n${t('groupDetails.inviteLinkInstructions')}`);
    } catch (err: unknown) {
      const errorMessage = err instanceof AxiosError 
        ? err.response?.data?.error || t('groupDetails.failedToGetInviteLink')
        : t('groupDetails.failedToGetInviteLink');
      showError(errorMessage);
    }
  };

  // Picture upload handler
  const handlePictureUpload = async (file: File) => {
    try {
      const response = await groupsAPI.uploadGroupPicture(groupId!, file);
      setGroupPicture(response.data.group.picture);
      showSuccess(t('groupDetails.groupPictureUpdated') || 'Group picture updated successfully');
      queryClient.invalidateQueries({ queryKey: ["groupDetails", groupId] });
    } catch (err: unknown) {
      const errorMessage = err instanceof AxiosError 
        ? err.response?.data?.error || t('groupDetails.failedToUploadPicture') || 'Failed to upload group picture'
        : t('groupDetails.failedToUploadPicture') || 'Failed to upload group picture';
      showError(errorMessage);
      throw err;
    }
  };

  // Picture delete handler
  const handleDeletePicture = async () => {
    try {
      const response = await groupsAPI.deleteGroupPicture(groupId!);
      setGroupPicture(response.data.group.picture ?? undefined);
      showSuccess(t('groupDetails.groupPictureDeleted') || 'Group picture deleted successfully');
      queryClient.invalidateQueries({ queryKey: ["groupDetails", groupId] });
    } catch (err: unknown) {
      const errorMessage = err instanceof AxiosError 
        ? err.response?.data?.error || t('groupDetails.failedToDeletePicture') || 'Failed to delete group picture'
        : t('groupDetails.failedToDeletePicture') || 'Failed to delete group picture';
      showError(errorMessage);
      throw err;
    }
  };

  // Create event handler
  const handleCreateEvent = useCallback(() => {
    setEditEvent(undefined);
    setEventModalOpen(true);
  }, []);

  const handleEventModalClose = useCallback(() => {
    setEventModalOpen(false);
  }, []);

  const handleEventModalSuccess = useCallback(() => {
    refetchEvents();
  }, [refetchEvents]);

  // Navigate to event requests page
  const handleViewEventRequests = useCallback(() => {
    if (groupId) {
      navigate(`/event-requests/${groupId}`);
    }
  }, [groupId, navigate]);

  if (groupLoading || eventsLoading || chatLoading) {
    return (
      <Box sx={{ textAlign: 'center', color: 'grey.300', mt: { xs: 5, sm: 8, md: 10 } }}>
        {t('groupDetails.loadingGroupDetails')}
      </Box>
    );
  }
  if (groupError || !group) {
    return (
      <Box sx={{ textAlign: 'center', color: 'error.light', mt: { xs: 5, sm: 8, md: 10 } }}>
        {t('groupDetails.failedToLoad')}
      </Box>
    );
  }

  const eventsArray = Array.isArray(events) ? events : (events?.data ?? []);

  // Defensive: always use array for members
  const _groupMembersArray = Array.isArray(members) ? members : [];

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(to bottom right, #0f172a, #1e293b)',
        color: 'white',
        py: { xs: 2, sm: 3, md: 4 },
        px: { xs: 2, sm: 3 },
      }}
    >
      <Container maxWidth="xl" disableGutters>
        <GroupHeader
          group={group}
          onEdit={isAdmin ? (() => setSettingsOpen(true)) : undefined}
          onDelete={isAdmin ? handleDeleteGroup : undefined}
          onLeave={isMember ? handleLeaveGroup : undefined}
          onInvite={canInvite ? handleInviteMember : undefined}
          onCopyLink={canCopyLink ? handleCopyLink : undefined}
          onViewEventRequests={isAdmin ? handleViewEventRequests : undefined}
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
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
            gap: { xs: 2, sm: 3, md: 4 },
          }}
        >
          {groupId && (
            <MemberList groupId={groupId} isAdmin={isAdmin} onRemove={isAdmin ? handleRemoveMember : undefined} />
          )}
          <EventList
            events={eventsArray}
            onEventClick={handleEventClick}
            onCreate={isMember ? handleCreateEvent : undefined}
            isAdmin={isAdmin}
            groupId={groupId}
            isMember={isMember}
          />
          <ChatBox chat={chatMessages || []} message={message} setMessage={setMessage} onSend={handleSend} isTyping={isTyping} />
        </Box>
      </Container>
      {/* Event create/edit modal */}
      <EventFormModal
        open={eventModalOpen}
        onClose={handleEventModalClose}
        onSuccess={handleEventModalSuccess}
        initialData={editEvent}
        groupId={groupId}
      />
      {/* Invite Member Modal */}
      <Dialog 
        open={showInviteModal} 
        onClose={() => setShowInviteModal(false)} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            width: { xs: '90vw', sm: '100%' },
            mx: { xs: 2, sm: 'auto' },
          }
        }}
      >
        <form onSubmit={handleInviteSubmit}>
          <DialogTitle sx={{ fontSize: { xs: '1.125rem', sm: '1.25rem' }, py: { xs: 2, sm: 2.5 } }}>
            {t('groupDetails.inviteMember')}
          </DialogTitle>
          <DialogContent sx={{ py: { xs: 2, sm: 2.5 } }}>
            <TextField
              label={t('common.email')}
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
              fullWidth
              margin="normal"
              InputProps={{
                sx: { minHeight: '44px' }
              }}
            />
          </DialogContent>
          <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 2.5 }, gap: 1 }}>
            <Button 
              onClick={() => setShowInviteModal(false)} 
              color="secondary"
              sx={{ minHeight: '44px', px: { xs: 2, sm: 3 } }}
            >
              {t('common.cancel')}
            </Button>
            <Button 
              type="submit" 
              variant="contained" 
              color="primary" 
              disabled={inviteMemberMutation.isPending}
              sx={{ minHeight: '44px', px: { xs: 2, sm: 3 } }}
            >
              {t('groupDetails.invite')}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Notification Snackbar */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={hideNotification}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={hideNotification}
          severity={notification.severity}
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>

      {/* Confirmation Dialogs using ConfirmationDialog */}
      <ConfirmationDialog
        open={showConfirm.open}
        title={t('groupDetails.removeMember')}
        message={t('groupDetails.confirmRemoveMember')}
        confirmText={t('common.remove')}
        confirmColor="error"
        loading={removeMemberMutation.isPending}
        onConfirm={confirmRemove}
        onCancel={() => setShowConfirm({ open: false, memberId: null })}
      />

      <ConfirmationDialog
        open={showDeleteConfirm}
        title={t('groupDetails.deleteGroup')}
        message={t('groupDetails.confirmDeleteGroup')}
        confirmText={t('common.delete')}
        confirmColor="error"
        loading={deleteGroupMutation.isLoading}
        onConfirm={confirmDeleteGroup}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      <ConfirmationDialog
        open={showLeaveConfirm}
        title={isAdmin && isOnlyMember() ? t('groupDetails.deleteGroup') : t('groupDetails.leave')}
        message={
          isAdmin && isOnlyMember() 
            ? t('groupDetails.confirmLeaveAsLastMember', 'You are the last member of this group. Leaving will delete the group permanently.')
            : t('groupDetails.confirmLeave')
        }
        confirmText={isAdmin && isOnlyMember() ? t('groupDetails.deleteGroup') : t('groupDetails.leave')}
        confirmColor="error"
        loading={leaveGroupMutation.isPending}
        onConfirm={confirmLeaveGroup}
        onCancel={() => setShowLeaveConfirm(false)}
      />

      {/* Admin Transfer Dialog (custom component) */}
      <AdminTransferDialog
        open={showAdminTransfer}
        members={members.filter((m: GroupMember) => m.id !== user?.id)}
        selectedNewAdmin={selectedNewAdmin}
        setSelectedNewAdmin={setSelectedNewAdmin}
        onConfirm={confirmAdminTransfer}
        onCancel={() => setShowAdminTransfer(false)}
        t={t}
      />
    </Box>
  );
}
