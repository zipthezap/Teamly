import { useState, useEffect, useCallback } from 'react';
import { groupsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { GroupWithDetails, GroupMember } from '../../../shared/types';

interface JoinRequest {
  id: string | number;
  groupId?: string | number;
  groupName?: string;
  user?: {
    name?: string;
    email?: string;
  };
  [key: string]: unknown;
}

interface UseJoinRequestsReturn {
  joinRequests: JoinRequest[];
  loading: boolean;
  refresh: () => Promise<void>;
  handleJoinRequest: (requestGroupId: string | number, requestId: string | number, action: string) => Promise<{ success: boolean; message: string }>;
}

export const useJoinRequests = (groupId: string | number | null = null): UseJoinRequestsReturn => {
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const fetchJoinRequests = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      if (groupId) {
        // Fetch requests for a specific group
        const response = await groupsAPI.getJoinRequests(groupId);
        setJoinRequests(response.data || []);
      } else {
        // Fetch all groups and filter for admin groups with pending requests
        const groupsResponse = await groupsAPI.getAll();
        const allGroups = groupsResponse.data || [];
        
        // Find groups where user is admin
        const adminGroups = allGroups.filter((group: GroupWithDetails) => 
          group.members?.some((m: GroupMember) => m.id === user.id && m.role === 'admin')
        );
        
        // Fetch join requests for each admin group
        // Note: This creates N API calls for N admin groups. 
        // Could be optimized with a dedicated backend endpoint like /groups/join-requests/all
        const requestsPromises = adminGroups.map((group: GroupWithDetails) => 
          groupsAPI.getJoinRequests(group.id)
            .then(res => res.data.map((req: JoinRequest) => ({ ...req, groupId: group.id, groupName: group.name })))
            .catch(() => [])
        );
        
        const allRequests = await Promise.all(requestsPromises);
        const flattenedRequests = allRequests.flat();
        setJoinRequests(flattenedRequests);
      }
    } catch (error) {
      console.error('Error fetching join requests:', error);
      setJoinRequests([]);
    } finally {
      setLoading(false);
    }
  }, [groupId, user]);

  useEffect(() => {
    fetchJoinRequests();
  }, [fetchJoinRequests]);

  const handleJoinRequest = async (requestGroupId: string | number, requestId: string | number, action: string) => {
    try {
      await groupsAPI.handleJoinRequest(requestGroupId, requestId, action);
      // Refresh the requests after handling
      await fetchJoinRequests();
      // Invalidate groupMembers query for instant update
      if (action === 'approve' || action === 'reject') {
        queryClient.invalidateQueries({ queryKey: ["groupMembers", requestGroupId] });
      }
      return { success: true, message: `Join request ${action === 'approve' ? 'approved' : 'rejected'}` };
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      return { 
        success: false, 
        message: err.response?.data?.error || 'Failed to process join request' 
      };
    }
  };

  return {
    joinRequests,
    loading,
    refresh: fetchJoinRequests,
    handleJoinRequest,
  };
};
