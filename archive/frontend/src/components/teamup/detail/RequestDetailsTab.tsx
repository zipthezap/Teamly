import React from 'react';
import { Box, Chip, Typography, Grid, Card, CardContent, LinearProgress } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { TeamUpRequest } from '../../../types/teamup';

interface RequestDetailsTabProps {
  request: TeamUpRequest;
  isUrgent: boolean;
  spotsLeft: number;
}

export const RequestDetailsTab: React.FC<RequestDetailsTabProps> = ({ request, isUrgent, spotsLeft }) => {
  const { t } = useTranslation();
  const spotsFilledPercent = ((request.playersNeeded - spotsLeft) / request.playersNeeded) * 100;

  return (
    <Box sx={{ px: 3 }}>
      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        {isUrgent && (
          <Chip
            label={t('teamup.urgent')}
            color="warning"
            size="small"
            sx={{ fontWeight: 700, fontSize: '0.75rem' }}
          />
        )}
        <Chip
          label={request.sportType}
          size="small"
          sx={{
            background: '#2196f3',
            color: 'white',
            fontWeight: 600,
            fontSize: '0.75rem'
          }}
        />
        <Chip
          label={t(`teamup.status.${request.status}`)}
          size="small"
          sx={{
            fontWeight: 600,
            fontSize: '0.75rem',
            ...(request.status === 'open' && {
              background: 'linear-gradient(135deg, #4caf50 0%, #8bc34a 100%)',
              color: 'white'
            }),
            ...(request.status === 'filled' && {
              backgroundColor: 'grey.400',
              color: 'white'
            })
          }}
        />
        {request.skillLevel && request.skillLevel !== 'any' && (
          <Chip
            label={t(`teamup.skillLevels.${request.skillLevel}`)}
            size="small"
            variant="outlined"
            sx={{
              borderColor: '#2196f3',
              color: '#2196f3',
              fontWeight: 600,
              fontSize: '0.75rem'
            }}
          />
        )}
      </Box>

      {request.description && (
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
        <Grid size={{ xs: 12, sm: 6 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                📅 {t('teamup.dateTime')}
              </Typography>
              <Typography variant="body1">
                {new Date(request.dateTime).toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        {request.location && (
          <Grid size={{ xs: 12, sm: 6 }}>
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
        <Grid size={{ xs: 12, sm: 6 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                👥 {t('teamup.playersNeeded')}
              </Typography>
              <Typography variant="body1">
                {request.playersNeeded} {spotsLeft < request.playersNeeded && `(${spotsLeft} ${t('teamup.spotsLeft')})`}
              </Typography>
              {spotsLeft < request.playersNeeded && (
                <LinearProgress 
                  variant="determinate" 
                  value={spotsFilledPercent} 
                  sx={{ 
                    mt: 1, 
                    height: 8, 
                    borderRadius: 1,
                    backgroundColor: 'grey.200',
                    '& .MuiLinearProgress-bar': {
                      background: '#2196f3'
                    }
                  }} 
                />
              )}
            </CardContent>
          </Card>
        </Grid>
        {request.city && (
          <Grid size={{ xs: 12, sm: 6 }}>
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
    </Box>
  );
};
