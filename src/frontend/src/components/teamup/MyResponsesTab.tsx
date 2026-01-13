import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Alert,
  Chip,
  Grid,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { teamUpAPI } from '../../services/api';
import { LoadingSpinner } from '../common';
import { TeamUpResponse } from '../../types/teamup';
import { getTeamUpStatusColor } from '../../utils/statusHelpers';

const MyResponsesTab = () => {
  const { t } = useTranslation();
  const [responses, setResponses] = useState<TeamUpResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMyResponses();
  }, []);

  const fetchMyResponses = async () => {
    try {
      setLoading(true);
      const response = await teamUpAPI.getMyResponses();
      setResponses(response.data);
    } catch (err) {
      console.error('Error fetching my responses:', err);
      setError(t('teamup.loadingResponses'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message={t('teamup.loadingResponses')} />;
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {responses.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary">
            {t('teamup.noResponsesYet')}
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {responses.map((response) => (
            <Grid size={{ xs: 12, md: 6, lg: 4 }} key={response.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="h6" component="div">
                      {response.teamUpRequest?.title}
                    </Typography>
                    <Chip
                      label={t(`teamup.responseStatus.${response.status}`)}
                      color={getTeamUpStatusColor(response.status)}
                      size="small"
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {response.teamUpRequest?.sportType}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    📅 {new Date(response.teamUpRequest?.dateTime || '').toLocaleString()}
                  </Typography>
                  {response.message && (
                    <Box sx={{ mt: 2, p: 1, bgcolor: 'grey.100', borderRadius: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        {t('teamup.yourMessage')}:
                      </Typography>
                      <Typography variant="body2">
                        {response.message}
                      </Typography>
                    </Box>
                  )}
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
                    {t('teamup.respondedOn')} {new Date(response.createdAt).toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
};

export default MyResponsesTab;
