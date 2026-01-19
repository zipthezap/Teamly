import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Box,
  CircularProgress,
  Button,
  Alert,
  Avatar,
  Chip,
  Divider,
  Card,
  CardContent,
  Grid,
} from '@mui/material';
import {
  People as PeopleIcon,
  Event as EventIcon,
  Person as PersonIcon,
  LocationOn as LocationIcon,
  SportsBaseball as SportsIcon,
} from '@mui/icons-material';
import { groupsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';

interface GroupInfoForInvite {
  id: string;
  name: string;
  description?: string | null;
  picture?: string | null;
  isPublic: boolean;
  sportType?: string | null;
  locationName?: string | null;
  city?: string | null;
  country?: string | null;
  tags?: string | null;
  creator?: {
    id: string;
    name: string;
    profilePicture?: string | null;
  };
  _count?: {
    members: number;
    events: number;
  };
  isMember?: boolean;
}

// Helper function to extract error message from API errors
const getErrorMessage = (err: unknown): string | null => {
  if (err && typeof err === 'object' && 'response' in err) {
    const response = (err as { response?: unknown }).response;
    if (response && typeof response === 'object' && 'data' in response) {
      const data = (response as { data?: unknown }).data;
      if (data && typeof data === 'object' && 'error' in data) {
        return String((data as { error: unknown }).error);
      }
    }
  }
  return null;
};

// Helper function to format location display
const getLocationDisplay = (groupInfo: GroupInfoForInvite | null): string | null => {
  if (!groupInfo) return null;
  
  const parts = [];
  if (groupInfo.locationName) parts.push(groupInfo.locationName);
  if (groupInfo.city) parts.push(groupInfo.city);
  if (groupInfo.country) parts.push(groupInfo.country);
  
  return parts.join(', ') || null;
};

const JoinGroup = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [loadingGroupInfo, setLoadingGroupInfo] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [groupInfo, setGroupInfo] = useState<GroupInfoForInvite | null>(null);

  // Fetch group info for display
  useEffect(() => {
    const fetchGroupInfo = async () => {
      if (!groupId) return;
      
      setLoadingGroupInfo(true);
      setError('');
      try {
        const res = await groupsAPI.getForInvite(groupId);
        setGroupInfo(res.data);
      } catch (err: unknown) {
        const errorMessage = getErrorMessage(err) || t('groups.joinGroup.failedToLoadGroup');
        setError(errorMessage);
      } finally {
        setLoadingGroupInfo(false);
      }
    };
    
    fetchGroupInfo();
  }, [groupId, t]);

  const handleJoinGroup = useCallback(async () => {
    if (!user) {
      setError(t('groups.joinGroup.loginToJoin'));
      return;
    }

    if (!groupId) {
      setError('Invalid group invitation');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      await groupsAPI.joinByInvite(groupId);
      setSuccess(t('groups.joinGroup.successfullyJoined'));
      
      // Invalidate caches so the joined group appears in the user's groups
      queryClient.invalidateQueries({ queryKey: ['groupsList'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['groupDetails', groupId] });
      queryClient.invalidateQueries({ queryKey: ['groupMembers', groupId] });
      
      setTimeout(() => {
        navigate(`/groups/${groupId}`);
      }, 1500);
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err) || t('groups.joinGroup.failedToJoin');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [user, groupId, navigate, t, queryClient]);

  const locationDisplay = getLocationDisplay(groupInfo);

  // Show loading state while fetching group info
  if (loadingGroupInfo) {
    return (
      <Container maxWidth="md" sx={{ mt: { xs: 4, sm: 6, md: 8 }, px: { xs: 2, sm: 3 } }}>
        <Paper sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
          <Box display="flex" justifyContent="center" alignItems="center" py={4}>
            <CircularProgress />
            <Typography variant="body1" sx={{ ml: 2 }}>
              {t('groups.joinGroup.loadingGroupInfo')}
            </Typography>
          </Box>
        </Paper>
      </Container>
    );
  }

  // Show error if group couldn't be loaded
  if (error && !groupInfo) {
    return (
      <Container maxWidth="md" sx={{ mt: { xs: 4, sm: 6, md: 8 }, px: { xs: 2, sm: 3 } }}>
        <Paper sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
          <Typography variant="h5" gutterBottom sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
            {t('groups.joinGroup.title')}
          </Typography>
          <Alert severity="error" sx={{ mt: 2, mb: 2 }}>{error}</Alert>
          <Button
            variant="outlined"
            onClick={() => navigate('/groups')}
            sx={{ minHeight: '44px' }}
          >
            {t('groups.joinGroup.goToGroups')}
          </Button>
        </Paper>
      </Container>
    );
  }

  // Not logged in view
  if (!user && groupInfo) {
    return (
      <Container maxWidth="md" sx={{ mt: { xs: 4, sm: 6, md: 8 }, px: { xs: 2, sm: 3 } }}>
        <Paper sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
          <Typography variant="h5" gutterBottom textAlign="center" sx={{ mb: 3, fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
            {t('groups.joinGroup.inviteTitle')}
          </Typography>

          {/* Group Preview Card */}
          <Card sx={{ mb: 4, bgcolor: 'background.default' }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                <Avatar
                  src={groupInfo.picture || undefined}
                  alt={groupInfo.name}
                  sx={{ width: 80, height: 80 }}
                >
                  {groupInfo.name.charAt(0).toUpperCase()}
                </Avatar>
                <Box flex={1}>
                  <Typography variant="h5" gutterBottom>
                    {groupInfo.name}
                  </Typography>
                  {groupInfo.sportType && (
                    <Chip
                      icon={<SportsIcon />}
                      label={groupInfo.sportType}
                      size="small"
                      sx={{ mr: 1 }}
                    />
                  )}
                  {groupInfo.isPublic && (
                    <Chip
                      label={t('common.public')}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  )}
                </Box>
              </Box>

              {groupInfo.description && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="body1" color="text.secondary">
                    {groupInfo.description}
                  </Typography>
                </>
              )}

              <Divider sx={{ my: 2 }} />

              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <PeopleIcon color="action" />
                    <Typography variant="body2" color="text.secondary">
                      {t('groups.joinGroup.memberCount', { count: groupInfo._count?.members || 0 })}
                    </Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <EventIcon color="action" />
                    <Typography variant="body2" color="text.secondary">
                      {t('groups.joinGroup.eventCount', { count: groupInfo._count?.events || 0 })}
                    </Typography>
                  </Box>
                </Grid>
                {locationDisplay && (
                  <Grid size={{ xs: 12 }}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <LocationIcon color="action" />
                      <Typography variant="body2" color="text.secondary">
                        {locationDisplay}
                      </Typography>
                    </Box>
                  </Grid>
                )}
                {groupInfo.creator && (
                  <Grid size={{ xs: 12 }}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <PersonIcon color="action" />
                      <Typography variant="body2" color="text.secondary">
                        {t('groups.joinGroup.createdBy')} {groupInfo.creator.name}
                      </Typography>
                    </Box>
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </Card>

          <Typography variant="body1" paragraph textAlign="center">
            {t('groups.joinGroup.loginToJoin')}
          </Typography>
          
          <Box 
            display="flex" 
            gap={2} 
            justifyContent="center"
            sx={{ flexDirection: { xs: 'column', sm: 'row' } }}
          >
            <Button
              variant="contained"
              size="large"
              onClick={() => navigate('/login', { state: { returnTo: `/join-group/${groupId}` } })}
              sx={{ minHeight: '48px', width: { xs: '100%', sm: 'auto' } }}
            >
              {t('groups.joinGroup.login')}
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={() => navigate('/register', { state: { returnTo: `/join-group/${groupId}` } })}
              sx={{ minHeight: '48px', width: { xs: '100%', sm: 'auto' } }}
            >
              {t('groups.joinGroup.signup')}
            </Button>
          </Box>
        </Paper>
      </Container>
    );
  }

  // Logged in view
  return (
    <Container maxWidth="md" sx={{ mt: { xs: 4, sm: 6, md: 8 }, px: { xs: 2, sm: 3 } }}>
      <Paper sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
        <Typography variant="h5" gutterBottom textAlign="center" sx={{ mb: 3, fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
          {groupInfo?.isMember ? t('groups.joinGroup.alreadyMember') : t('groups.joinGroup.inviteTitle')}
        </Typography>

        {groupInfo && (
          <Card sx={{ mb: 4, bgcolor: 'background.default' }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                <Avatar
                  src={groupInfo.picture || undefined}
                  alt={groupInfo.name}
                  sx={{ width: 80, height: 80 }}
                >
                  {groupInfo.name.charAt(0).toUpperCase()}
                </Avatar>
                <Box flex={1}>
                  <Typography variant="h5" gutterBottom>
                    {groupInfo.name}
                  </Typography>
                  {groupInfo.sportType && (
                    <Chip
                      icon={<SportsIcon />}
                      label={groupInfo.sportType}
                      size="small"
                      sx={{ mr: 1 }}
                    />
                  )}
                  {groupInfo.isPublic && (
                    <Chip
                      label={t('common.public')}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  )}
                </Box>
              </Box>

              {groupInfo.description && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="body1" color="text.secondary">
                    {groupInfo.description}
                  </Typography>
                </>
              )}

              <Divider sx={{ my: 2 }} />

              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <PeopleIcon color="action" />
                    <Typography variant="body2" color="text.secondary">
                      {t('groups.joinGroup.memberCount', { count: groupInfo._count?.members || 0 })}
                    </Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <EventIcon color="action" />
                    <Typography variant="body2" color="text.secondary">
                      {t('groups.joinGroup.eventCount', { count: groupInfo._count?.events || 0 })}
                    </Typography>
                  </Box>
                </Grid>
                {locationDisplay && (
                  <Grid size={{ xs: 12 }}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <LocationIcon color="action" />
                      <Typography variant="body2" color="text.secondary">
                        {locationDisplay}
                      </Typography>
                    </Box>
                  </Grid>
                )}
                {groupInfo.creator && (
                  <Grid size={{ xs: 12 }}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <PersonIcon color="action" />
                      <Typography variant="body2" color="text.secondary">
                        {t('groups.joinGroup.createdBy')} {groupInfo.creator.name}
                      </Typography>
                    </Box>
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </Card>
        )}
        
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
        
        {loading && (
          <Box display="flex" justifyContent="center" alignItems="center" py={4}>
            <CircularProgress />
            <Typography variant="body1" sx={{ ml: 2 }}>
              {t('groups.joinGroup.joining')}
            </Typography>
          </Box>
        )}
        
        {!loading && !success && (
          <Box 
            display="flex" 
            gap={2} 
            justifyContent="center"
            sx={{ flexDirection: { xs: 'column', sm: 'row' } }}
          >
            {groupInfo?.isMember ? (
              <Button
                variant="contained"
                size="large"
                onClick={() => navigate(`/groups/${groupId}`)}
                sx={{ minHeight: '48px', width: { xs: '100%', sm: 'auto' } }}
              >
                {t('groups.joinGroup.viewGroup')}
              </Button>
            ) : (
              <Button
                variant="contained"
                size="large"
                onClick={handleJoinGroup}
                disabled={loading}
                sx={{ minHeight: '48px', width: { xs: '100%', sm: 'auto' } }}
              >
                {t('groups.joinGroup.joinNow')}
              </Button>
            )}
            <Button
              variant="outlined"
              size="large"
              onClick={() => navigate('/groups')}
              disabled={loading}
              sx={{ minHeight: '48px', width: { xs: '100%', sm: 'auto' } }}
            >
              {t('common.cancel')}
            </Button>
          </Box>
        )}
      </Paper>
    </Container>
  );
};

export default JoinGroup;
