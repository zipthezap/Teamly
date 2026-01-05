import { useState, useEffect, useCallback } from 'react';
import { groupsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export const useJoinRequests = (groupId = null) => {
  const [joinRequests, setJoinRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

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
        const adminGroups = allGroups.filter(group => 
          group.members?.some(m => m.userId === user.id && m.role === 'admin')
        );
        
        // Fetch join requests for each admin group
        const requestsPromises = adminGroups.map(group => 
          groupsAPI.getJoinRequests(group.id)
            .then(res => res.data.map(req => ({ ...req, groupId: group.id, groupName: group.name })))
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

  const handleJoinRequest = async (requestGroupId, requestId, action) => {
    try {
      await groupsAPI.handleJoinRequest(requestGroupId, requestId, action);
      // Refresh the requests after handling
      await fetchJoinRequests();
      return { success: true, message: `Join request ${action === 'approve' ? 'approved' : 'rejected'}` };
    } catch (error) {
      return { 
        success: false, 
        message: error.response?.data?.error || 'Failed to process join request' 
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
