import React, { useState, useEffect, useCallback } from 'react';
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
  TextField,
  IconButton,
  Alert,
  Tab,
  Tabs,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import ChatIcon from '@mui/icons-material/Chat';
import InfoIcon from '@mui/icons-material/Info';
import { useTranslation } from 'react-i18next';
import { teamUpAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { getImageUrl, getInitials } from '../../utils/imageUtils';
import { TeamUpRequestWithDetails, TeamUpComment, TeamUpResponse } from '../../types/teamup';
import { TabPanel } from '../common';
import { RequestDetailsTab } from './detail/RequestDetailsTab';
import { ResponsesList } from './detail/ResponsesList';
import { CommentsList } from './detail/CommentsList';
import { getErrorMessage } from '../../utils/errorHandler';
import { ResponseForm } from './detail/ResponseForm';

interface TeamUpDetailModalProps {
  open: boolean;
  onClose: () => void;
  requestId: string;
  onUpdate?: () => void;
}

const TeamUpDetailModal: React.FC<TeamUpDetailModalProps> = ({ open, onClose, requestId, onUpdate }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [tabValue, setTabValue] = useState(0);
  const [request, setRequest] = useState<TeamUpRequestWithDetails | null>(null);
  const [comments, setComments] = useState<TeamUpComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [newComment, setNewComment] = useState('');
  const [responseMessage, setResponseMessage] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [submittingResponse, setSubmittingResponse] = useState(false);
  const [processingResponseId, setProcessingResponseId] = useState<string | null>(null);

  const fetchRequestDetails = useCallback(async () => {
    try {
      setLoading(true);
      const response = await teamUpAPI.getById(requestId);
      setRequest(response.data);
      setComments(response.data.comments || []);
    } catch {
      setError(t('teamup.loadingError'));
    } finally {
      setLoading(false);
    }
  }, [requestId, t]);

  useEffect(() => {
    if (open && requestId) {
      fetchRequestDetails();
    }
  }, [open, requestId, fetchRequestDetails]);

  const handleAddComment = async () => {
    if (!newComment.trim() || !requestId) return;

    try {
      setSubmittingComment(true);
      const response = await teamUpAPI.addComment(requestId, newComment);
      setComments([...comments, response.data]);
      setNewComment('');
      setSuccess(t('teamup.commentAdded'));
    } catch (err: unknown) {
      setError(getErrorMessage(err) || t('teamup.commentError'));
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
    } catch (err: unknown) {
      setError(getErrorMessage(err) || t('teamup.commentDeleteError'));
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
    } catch (err: unknown) {
      setError(getErrorMessage(err) || t('teamup.respondError'));
    } finally {
      setSubmittingResponse(false);
    }
  };

  const handleResponseAction = async (responseId: string, action: 'accept' | 'decline') => {
    try {
      setProcessingResponseId(responseId);
      await teamUpAPI.handleResponse(requestId, responseId, action);
      setSuccess(
        action === 'accept'
          ? t('teamup.acceptResponseSuccess')
          : t('teamup.declineResponseSuccess')
      );
      fetchRequestDetails();
      if (onUpdate) onUpdate();
    } catch {
      setError(
        action === 'accept'
          ? t('teamup.acceptResponseError')
          : t('teamup.declineResponseError')
      );
    } finally {
      setProcessingResponseId(null);
    }
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const isOwnRequest = request?.creator?.id === user?.id;
  const hasResponded = request?.responses?.some((r) => r.id === user?.id);
  const acceptedResponses = request?.responses?.filter((r: TeamUpResponse) => r.status === 'accepted').length || 0;
  const pendingResponses = request?.responses?.filter((r: TeamUpResponse) => r.status === 'pending').length || 0;
  const spotsLeft = (request?.playersNeeded || 0) - acceptedResponses;

  const eventDate = request ? new Date(request.dateTime).getTime() : 0;
  const now = Date.now();
  const hoursUntil = (eventDate - now) / (1000 * 60 * 60);
  const isUrgent = hoursUntil <= 48 && hoursUntil > 0;

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
        sx: { 
          height: '90vh',
          borderRadius: 3,
          overflow: 'hidden'
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        borderBottom: 1,
        borderColor: 'divider',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        py: 2
      }}>
        <Typography variant="h5" component="div" sx={{ fontWeight: 700 }}>
          {request?.title || t('teamup.activityDetails')}
        </Typography>
        <IconButton onClick={onClose} edge="end" sx={{ color: 'white' }}>
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
        sx={{ 
          borderBottom: 1, 
          borderColor: 'divider', 
          px: 2,
          backgroundColor: 'grey.50',
          '& .MuiTab-root': {
            fontWeight: 600,
            textTransform: 'none',
            fontSize: '0.95rem',
            minHeight: 64,
            transition: 'all 0.3s ease',
            '&:hover': {
              backgroundColor: 'rgba(102, 126, 234, 0.08)'
            },
            '&.Mui-selected': {
              color: '#667eea'
            }
          },
          '& .MuiTabs-indicator': {
            height: 3,
            borderRadius: '3px 3px 0 0',
            backgroundColor: '#667eea'
          }
        }}
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
              {request && (
                <>
                  <RequestDetailsTab 
                    request={request}
                    isUrgent={isUrgent}
                    spotsLeft={spotsLeft}
                  />
                  
                  <Box sx={{ px: 3 }}>
                    <Divider sx={{ my: 2 }} />

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                      <Avatar
                        src={getImageUrl(request.creator?.profilePicture)}
                        sx={{ width: 48, height: 48 }}
                      >
                        {getInitials(request.creator?.name || 'User')}
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle2">
                          {t('teamup.postedBy')}
                        </Typography>
                        <Typography variant="body1" fontWeight="bold">
                          {request.creator?.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(request.createdAt).toLocaleDateString()}
                        </Typography>
                      </Box>
                    </Box>

                    {!isOwnRequest && !hasResponded && request.status === 'open' && (
                      <ResponseForm
                        message={responseMessage}
                        onMessageChange={setResponseMessage}
                        onSubmit={handleRespond}
                        isSubmitting={submittingResponse}
                        spotsLeft={spotsLeft}
                        isOwnRequest={isOwnRequest}
                      />
                    )}
                  </Box>
                </>
              )}
            </TabPanel>

            {/* Activity Tab - Combined Responses and Chat */}
            <TabPanel value={tabValue} index={1}>
              <Box sx={{ px: 3, display: 'flex', flexDirection: 'column' }}>
                {request?.responses && request.responses.length > 0 && (
                  <ResponsesList
                    responses={request.responses}
                    pendingCount={pendingResponses}
                    isCreator={isOwnRequest}
                    onAccept={(responseId) => handleResponseAction(responseId, 'accept')}
                    onDecline={(responseId) => handleResponseAction(responseId, 'decline')}
                    processingResponseId={processingResponseId}
                  />
                )}

                <CommentsList
                  comments={comments}
                  currentUserId={user?.id}
                  onDeleteComment={handleDeleteComment}
                />

                {/* Add Comment Input */}
                <Box sx={{ 
                  pt: 2, 
                  borderTop: 1, 
                  borderColor: 'divider',
                  backgroundColor: 'grey.50',
                  borderRadius: 2,
                  p: 2,
                  mt: 2
                }}>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
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
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          backgroundColor: 'white',
                          '&:hover fieldset': {
                            borderColor: '#667eea'
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: '#667eea'
                          }
                        }
                      }}
                    />
                    <IconButton 
                      onClick={handleAddComment}
                      disabled={!newComment.trim() || submittingComment}
                      sx={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        boxShadow: '0 2px 8px rgba(102, 126, 234, 0.4)',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #5568d3 0%, #6a3d8f 100%)',
                          boxShadow: '0 4px 12px rgba(102, 126, 234, 0.5)'
                        },
                        '&:disabled': {
                          background: 'grey.300',
                          color: 'grey.500'
                        }
                      }}
                    >
                      <SendIcon />
                    </IconButton>
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
