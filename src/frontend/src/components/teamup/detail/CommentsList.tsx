import React from 'react';
import { Box, Typography, List, ListItem, ListItemAvatar, ListItemText, Avatar, Divider, IconButton } from '@mui/material';
import ChatIcon from '@mui/icons-material/Chat';
import DeleteIcon from '@mui/icons-material/Delete';
import { useTranslation } from 'react-i18next';
import { TeamUpComment } from '../../../types/teamup';
import { getImageUrl, getInitials } from '../../../utils/imageUtils';

interface CommentsListProps {
  comments: TeamUpComment[];
  currentUserId?: string;
  onDeleteComment: (commentId: string) => void;
}

export const CommentsList: React.FC<CommentsListProps> = ({ comments, currentUserId, onDeleteComment }) => {
  const { t } = useTranslation();

  if (!comments || comments.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
        <ChatIcon sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
        <Typography variant="body2">
          {t('teamup.noComments')}
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 600 }}>
        <ChatIcon sx={{ color: '#2196f3' }} /> {t('teamup.comments')} ({comments.length})
      </Typography>
      <List sx={{ bgcolor: 'background.paper', borderRadius: 2 }}>
        {comments.map((comment, index) => (
          <React.Fragment key={comment.id}>
            <ListItem
              alignItems="flex-start"
              sx={{
                py: 2,
                px: 2,
                '&:hover': {
                  backgroundColor: 'action.hover'
                }
              }}
              secondaryAction={
                comment.id === currentUserId ? (
                  <IconButton
                    edge="end"
                    aria-label="delete"
                    onClick={() => onDeleteComment(comment.id)}
                    sx={{ 
                      color: 'error.main',
                      '&:hover': {
                        backgroundColor: 'error.light',
                        color: 'white'
                      }
                    }}
                  >
                    <DeleteIcon />
                  </IconButton>
                ) : undefined
              }
            >
              <ListItemAvatar>
                <Avatar
                  src={getImageUrl(comment.user?.profilePicture)}
                  sx={{
                    border: '2px solid',
                    borderColor: 'primary.light'
                  }}
                >
                  {getInitials(comment.user?.name || 'User')}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Typography variant="subtitle2" fontWeight="bold">
                    {comment.user?.name}
                  </Typography>
                }
                secondary={
                  <>
                    <Typography
                      component="span"
                      variant="body2"
                      color="text.primary"
                      sx={{ display: 'block', mt: 0.5, mb: 0.5 }}
                    >
                      {comment.content}
                    </Typography>
                    <Typography
                      component="span"
                      variant="caption"
                      color="text.disabled"
                    >
                      {new Date(comment.createdAt).toLocaleString()}
                    </Typography>
                  </>
                }
              />
            </ListItem>
            {index < comments.length - 1 && <Divider variant="inset" component="li" />}
          </React.Fragment>
        ))}
      </List>
    </Box>
  );
};
