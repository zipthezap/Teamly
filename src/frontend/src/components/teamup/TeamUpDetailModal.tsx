import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Button,
  Typography,
  Divider,
  Avatar,
  Chip,
  TextField,
  IconButton,
  Card,
  CardContent,
  Grid,
  LinearProgress,
  Stack,
  Alert,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Tab,
  Tabs,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import ChatIcon from '@mui/icons-material/Chat';
import PeopleIcon from '@mui/icons-material/People';
import InfoIcon from '@mui/icons-material/Info';
import { useTranslation } from 'react-i18next';
import { teamUpAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { getImageUrl, getInitials } from '../../utils/imageUtils';
import { TeamUpRequest, TeamUpComment, TeamUpResponse } from '../../types/teamup';

interface TeamUpDetailModalProps {
  open: boolean;
  onClose: () => void;
  requestId: string;
  onUpdate?: () => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`teamup-tabpanel-${index}`}
      aria-labelledby={`teamup-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
}

const TeamUpDetailModal: React.FC<TeamUpDetailModalProps> = ({ open, onClose, requestId, onUpdate }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [tabValue, setTabValue] = useState(0);
  const [request, setRequest] = useState<TeamUpRequest | null>(null);
  const [comments, setComments] = useState<TeamUpComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [newComment, setNewComment] = useState('');
  const [responseMessage, setResponseMessage] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [submittingResponse, setSubmittingResponse] = useState(false);

  useEffect(() => {
    if (open && requestId) {
      fetchRequestDetails();
    }
  }, [open, requestId]);

  const fetchRequestDetails = async () => {
    try {
      setLoading(true);
      const response = await teamUpAPI.getById(requestId);
      setRequest(response.data);
      setComments(response.data.comments || []);
    } catch (err) {
      console.error('Error fetching request details:', err);
      setError(t('teamup.loadingError'));
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !requestId) return;

    try {
      setSubmittingComment(true);
      const response = await teamUpAPI.addComment(requestId, newComment);
      setComments([...comments, response.data]);
      setNewComment('');
      setSuccess(t('teamup.commentAdded'));
    } catch (err: any) {
      console.error('Error adding comment:', err);
      setError(err.response?.data?.error || t('teamup.commentError'));
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm(t('teamup.confirmDeleteComment'))) return;

    try {
      await teamUpAPI.deleteComment(requestId, commentId);
      setComments(comments.filter(c => c.id !== commentId));
      setSuccess(t('teamup.commentDeleted'));
    } catch (err: any) {
      console.error('Error deleting comment:', err);
      setError(err.response?.data?.error || t('teamup.commentDeleteError'));
    }
  };

  const handleRespond = async () => {
    if (!requestId) return;

    try {
      setSubmittingResponse(true);
      await teamUpAPI.respond(requestId, responseMessage);
      setSuccess(t('teamup.respondSuccess'));
      setResponseMessage('');
      fetchRequestDetails();
      if (onUpdate) onUpdate();
    } catch (err: any) {
      console.error('Error responding:', err);
      setError(err.response?.data?.error || t('teamup.respondError'));
    } finally {
      setSubmittingResponse(false);
    }
  };

  const handleResponseAction = async (responseId: string, action: 'accept' | 'decline') => {
    try {
      await teamUpAPI.handleResponse(requestId, responseId, action);
      setSuccess(
        action === 'accept'
          ? t('teamup.acceptResponseSuccess')
          : t('teamup.declineResponseSuccess')
      );
      fetchRequestDetails();
      if (onUpdate) onUpdate();
    } catch (err: any) {
      console.error('Error handling response:', err);
      setError(
        action === 'accept'
          ? t('teamup.acceptResponseError')
          : t('teamup.declineResponseError')
      );
    }
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const isOwnRequest = request?.creator?.id === user?.id;
  const hasResponded = request?.responses?.some((r) => r.userId === user?.id);
  const acceptedResponses = request?.responses?.filter((r) => r.status === 'accepted').length || 0;
  const pendingResponses = request?.responses?.filter((r) => r.status === 'pending').length || 0;
  const spotsLeft = (request?.playersNeeded || 0) - acceptedResponses;

  const eventDate = request ? new Date(request.dateTime).getTime() : 0;
  const now = Date.now();
  const hoursUntil = (eventDate - now) / (1000 * 60 * 60);
  const isUrgent = hoursUntil <= 48 && hoursUntil > 0;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted':
        return 'success';
      case 'declined':
        return 'error';
      default:
        return 'default';
    }
  };

  if (!request && !loading) {
    return null;
  }

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: { height: '90vh' }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        borderBottom: 1,
        borderColor: 'divider'
      }}>
        <Typography variant="h5" component="div">
          {request?.title || t('teamup.activityDetails')}
        </Typography>
        <IconButton onClick={onClose} edge="end">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      {error && (
        <Alert severity="error" sx={{ m: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ m: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      <Tabs 
        value={tabValue} 
        onChange={handleTabChange}
        sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
      >
        <Tab 
          icon={<InfoIcon />} 
          iconPosition="start" 
          label={t('teamup.details')} 
          id="teamup-tab-0" 
        />
        <Tab 
          icon={<ChatIcon />} 
          iconPosition="start" 
          label={`${t('teamup.activity')} (${(request?.responses?.length || 0) + comments.length})`}
          id="teamup-tab-1" 
        />
      </Tabs>

      <DialogContent sx={{ p: 0, overflow: 'auto' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
            <Typography>{t('common.loading')}...</Typography>
          </Box>
        ) : (
          <>
            {/* Details Tab */}
            <TabPanel value={tabValue} index={0}>
              <Box sx={{ px: 3 }}>
                <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                  {isUrgent && (
                    <Chip
                      label={t('teamup.urgent')}
                      color="warning"
                      size="small"
                      sx={{ fontWeight: 'bold' }}
                    />
                  )}
                  <Chip
                    label={request?.sportType}
                    color="primary"
                    size="small"
                  />
                  <Chip
                    label={t(`teamup.status.${request?.status}`)}
                    color={request?.status === 'open' ? 'success' : 'default'}
                    size="small"
                  />
                  {request?.skillLevel && request.skillLevel !== 'any' && (
                    <Chip
                      label={t(`teamup.skillLevels.${request.skillLevel}`)}
                      size="small"
                      variant="outlined"
                    />
                  )}
                </Box>

                {request?.description && (
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="h6" gutterBottom>
                      {t('teamup.description')}
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                      {request.description}
                    </Typography>
                  </Box>
                )}

                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={12} sm={6}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                          📅 {t('teamup.dateTime')}
                        </Typography>
                        <Typography variant="body1">
                          {new Date(request?.dateTime || '').toLocaleString()}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  {request?.location && (
                    <Grid item xs={12} sm={6}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            📍 {t('teamup.location')}
                          </Typography>
                          <Typography variant="body1">
                            {request.location}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  )}
                  {request?.city && (
                    <Grid item xs={12} sm={6}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            🌍 {t('teamup.city')}
                          </Typography>
                          <Typography variant="body1">
                            {request.city}{request.country ? `, ${request.country}` : ''}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  )}
                </Grid>

                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    {t('teamup.spotsFilled')}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box sx={{ flex: 1 }}>
                      <LinearProgress 
                        variant="determinate" 
                        value={(acceptedResponses / (request?.playersNeeded || 1)) * 100}
                        sx={{ 
                          height: 10, 
                          borderRadius: 1,
                          backgroundColor: 'rgba(0, 0, 0, 0.1)',
                          '& .MuiLinearProgress-bar': {
                            backgroundColor: spotsLeft === 0 ? '#4caf50' : '#2196f3'
                          }
                        }}
                      />
                    </Box>
                    <Typography variant="body1" fontWeight="bold">
                      {acceptedResponses}/{request?.playersNeeded}
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {spotsLeft > 0 
                      ? `${spotsLeft} ${t('teamup.spotsLeft')}`
                      : t('teamup.allSpotsFilled')
                    }
                  </Typography>
                </Box>

                <Divider sx={{ my: 2 }} />

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar
                    src={getImageUrl(request?.creator?.profilePicture)}
                    sx={{ width: 48, height: 48 }}
                  >
                    {getInitials(request?.creator?.name || 'User')}
                  </Avatar>
                  <Box>
                    <Typography variant="subtitle2">
                      {t('teamup.postedBy')}
                    </Typography>
                    <Typography variant="body1" fontWeight="bold">
                      {request?.creator?.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(request?.createdAt || '').toLocaleDateString()}
                    </Typography>
                  </Box>
                </Box>

                {!isOwnRequest && !hasResponded && request?.status === 'open' && (
                  <Box sx={{ mt: 3 }}>
                    <Typography variant="h6" gutterBottom>
                      {t('teamup.expressInterest')}
                    </Typography>
                    <TextField
                      fullWidth
                      multiline
                      rows={3}
                      label={t('teamup.addMessage')}
                      value={responseMessage}
                      onChange={(e) => setResponseMessage(e.target.value)}
                      placeholder={t('teamup.tellThemWhy')}
                      sx={{ mb: 2 }}
                    />
                    <Button
                      fullWidth
                      variant="contained"
                      onClick={handleRespond}
                      disabled={submittingResponse || spotsLeft === 0}
                      startIcon={<SendIcon />}
                    >
                      {submittingResponse ? t('common.sending') : t('teamup.sendResponse')}
                    </Button>
                  </Box>
                )}
              </Box>
            </TabPanel>

            {/* Activity Tab - Combined Responses and Chat */}
            <TabPanel value={tabValue} index={1}>
              <Box sx={{ px: 3, display: 'flex', flexDirection: 'column' }}>
                {/* Pending Responses Alert */}
                {pendingResponses > 0 && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    {pendingResponses} {t('teamup.pendingResponses')}
                  </Alert>
                )}

                {/* Responses Section */}
                {request?.responses && request.responses.length > 0 && (
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PeopleIcon /> {t('teamup.responses')} ({request.responses.length})
                    </Typography>
                    <Stack spacing={2}>
                      {request.responses.map((response: TeamUpResponse) => (
                        <Card key={response.id} variant="outlined">
                          <CardContent>
                            <Box sx={{ display: 'flex', gap: 2 }}>
                              <Avatar
                                src={getImageUrl(response.user?.profilePicture)}
                                sx={{ width: 48, height: 48 }}
                              >
                                {getInitials(response.user?.name || 'User')}
                              </Avatar>
                              <Box sx={{ flex: 1 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                  <Typography variant="subtitle1" fontWeight="bold">
                                    {response.user?.name}
                                  </Typography>
                                  <Chip
                                    label={t(`teamup.responseStatus.${response.status}`)}
                                    color={getStatusColor(response.status)}
                                    size="small"
                                  />
                                </Box>
                                {response.message && (
                                  <Box sx={{ mb: 1, p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}>
                                    <Typography variant="body2">
                                      "{response.message}"
                                    </Typography>
                                  </Box>
                                )}
                                <Typography variant="caption" color="text.secondary">
                                  {new Date(response.createdAt).toLocaleString()}
                                </Typography>
                                {isOwnRequest && response.status === 'pending' && (
                                  <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                                    <Button
                                      size="small"
                                      variant="contained"
                                      color="success"
                                      startIcon={<CheckCircleIcon />}
                                      onClick={() => handleResponseAction(response.id, 'accept')}
                                      disabled={spotsLeft === 0}
                                    >
                                      {t('teamup.acceptResponse')}
                                    </Button>
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      color="error"
                                      startIcon={<CancelIcon />}
                                      onClick={() => handleResponseAction(response.id, 'decline')}
                                    >
                                      {t('teamup.declineResponse')}
                                    </Button>
                                  </Stack>
                                )}
                              </Box>
                            </Box>
                          </CardContent>
                        </Card>
                      ))}
                    </Stack>
                  </Box>
                )}

                {/* Chat/Comments Section */}
                <Box>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ChatIcon /> {t('teamup.chat')} ({comments.length})
                  </Typography>
                  <List sx={{ mb: 2, maxHeight: 300, overflow: 'auto' }}>
                    {comments.length > 0 ? (
                      comments.map((comment) => (
                        <ListItem
                          key={comment.id}
                          alignItems="flex-start"
                          sx={{ 
                            bgcolor: comment.userId === user?.id ? 'primary.50' : 'transparent',
                            borderRadius: 1,
                            mb: 1
                          }}
                          secondaryAction={
                            comment.userId === user?.id && (
                              <IconButton 
                                edge="end" 
                                aria-label="delete"
                                onClick={() => handleDeleteComment(comment.id)}
                                size="small"
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            )
                          }
                        >
                          <ListItemAvatar>
                            <Avatar src={getImageUrl(comment.user?.profilePicture)}>
                              {getInitials(comment.user?.name || 'User')}
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="subtitle2" fontWeight="bold">
                                  {comment.user?.name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {new Date(comment.createdAt).toLocaleString()}
                                </Typography>
                              </Box>
                            }
                            secondary={
                              <Typography variant="body2" sx={{ mt: 0.5 }}>
                                {comment.content}
                              </Typography>
                            }
                          />
                        </ListItem>
                      ))
                    ) : (
                      <Box sx={{ textAlign: 'center', py: 4 }}>
                        <Typography variant="body2" color="text.secondary">
                          {t('teamup.noComments')}
                        </Typography>
                      </Box>
                    )}
                  </List>
                  
                  {/* Add Comment Input */}
                  <Box sx={{ pt: 2, borderTop: 1, borderColor: 'divider' }}>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <TextField
                        fullWidth
                        size="small"
                        placeholder={t('teamup.typeMessage')}
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleAddComment();
                          }
                        }}
                        multiline
                        maxRows={3}
                      />
                      <IconButton 
                        color="primary" 
                        onClick={handleAddComment}
                        disabled={!newComment.trim() || submittingComment}
                      >
                        <SendIcon />
                      </IconButton>
                    </Box>
                  </Box>
                </Box>

                {/* Empty State */}
                {(!request?.responses || request.responses.length === 0) && comments.length === 0 && (
                  <Box sx={{ textAlign: 'center', py: 8 }}>
                    <Typography variant="h6" color="text.secondary">
                      {t('teamup.noActivityYet')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {t('teamup.beTheFirst')}
                    </Typography>
                  </Box>
                )}
              </Box>
            </TabPanel>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ borderTop: 1, borderColor: 'divider', px: 3, py: 2 }}>
        <Button onClick={onClose} variant="outlined">
          {t('common.close')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TeamUpDetailModal;
