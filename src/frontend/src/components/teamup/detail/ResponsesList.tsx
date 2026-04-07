import React from 'react';
import { Box, Alert, Typography, Stack, Card, CardContent, Avatar, Chip, Button } from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import { useTranslation } from 'react-i18next';
import { TeamUpResponse } from '../../../types/teamup';
import { getImageUrl, getInitials } from '../../../utils/imageUtils';
import { getTeamUpStatusColor } from '../../../utils/statusHelpers';

interface ResponsesListProps {
  responses: TeamUpResponse[];
  pendingCount: number;
  isCreator: boolean;
  onAccept: (responseId: string) => void;
  onDecline: (responseId: string) => void;
  processingResponseId: string | null;
}

export const ResponsesList: React.FC<ResponsesListProps> = ({
  responses,
  pendingCount,
  isCreator,
  onAccept,
  onDecline,
  processingResponseId
}) => {
  const { t } = useTranslation();

  if (!responses || responses.length === 0) {
    return null;
  }

  return (
    <Box sx={{ mb: 3 }}>
      {pendingCount > 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {pendingCount} {t('teamup.pendingResponses')}
        </Alert>
      )}

      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 600 }}>
        <PeopleIcon sx={{ color: '#2196f3' }} /> {t('teamup.responses')} ({responses.length})
      </Typography>
      
      <Stack spacing={2}>
        {responses.map((response) => (
          <Card 
            key={response.id} 
            variant="outlined"
            sx={{
              borderRadius: 2,
              borderColor: response.status === 'accepted' 
                ? 'success.light' 
                : response.status === 'declined'
                ? 'error.light'
                : 'divider',
              borderWidth: 2,
              transition: 'all 0.3s ease',
              '&:hover': {
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }
            }}
          >
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Avatar
                  src={getImageUrl(response.user?.profilePicture)}
                  sx={{ 
                    width: 48, 
                    height: 48,
                    border: '3px solid',
                    borderColor: response.status === 'accepted' 
                      ? 'success.light' 
                      : response.status === 'declined'
                      ? 'error.light'
                      : 'primary.light'
                  }}
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
                      color={getTeamUpStatusColor(response.status)}
                      size="small"
                      sx={{ fontWeight: 600 }}
                    />
                  </Box>
                  {response.message && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {response.message}
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.disabled">
                    {new Date(response.createdAt).toLocaleString()}
                  </Typography>
                  {isCreator && response.status === 'pending' && (
                    <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                      <Button
                        size="small"
                        variant="contained"
                        color="success"
                        startIcon={<CheckCircleIcon />}
                        onClick={() => onAccept(response.id)}
                        disabled={processingResponseId === response.id}
                        sx={{
                          flex: 1,
                          textTransform: 'none',
                          fontWeight: 600,
                          boxShadow: '0 2px 8px rgba(76, 175, 80, 0.3)',
                          '&:hover': {
                            boxShadow: '0 4px 12px rgba(76, 175, 80, 0.4)'
                          }
                        }}
                      >
                        {processingResponseId === response.id ? t('common.processing') : t('teamup.accept')}
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        startIcon={<CancelIcon />}
                        onClick={() => onDecline(response.id)}
                        disabled={processingResponseId === response.id}
                        sx={{
                          flex: 1,
                          textTransform: 'none',
                          fontWeight: 600
                        }}
                      >
                        {processingResponseId === response.id ? t('common.processing') : t('teamup.decline')}
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
  );
};
