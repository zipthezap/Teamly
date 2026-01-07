import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Paper,
  Typography,
  Box,
  TextField,
  Button,
  Grid,
  Stack,
} from '@mui/material';

interface ProfileFormProps {
  formData: {
    name: string;
    email: string;
    city: string;
    country: string;
  };
  loading: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
}

const ProfileForm: React.FC<ProfileFormProps> = ({
  formData,
  loading,
  onChange,
  onSubmit,
}) => {
  const { t } = useTranslation();
  return (
    <Paper sx={{ p: 4 }}>
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
        {t('profile.infoTitle')}
      </Typography>
      <form onSubmit={onSubmit}>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6}>
            <TextField
              label={t('common.name')}
              name="name"
              value={formData.name}
              onChange={onChange}
              fullWidth
              required
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label={t('common.email')}
              name="email"
              type="email"
              value={formData.email}
              onChange={onChange}
              fullWidth
              required
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label={t('profile.city')}
              name="city"
              value={formData.city}
              onChange={onChange}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label={t('profile.country')}
              name="country"
              value={formData.country}
              onChange={onChange}
              fullWidth
            />
          </Grid>
        </Grid>
        <Box sx={{ mt: 3 }}>
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={loading}
          >
            {t('profile.updateProfile')}
          </Button>
        </Box>
      </form>
    </Paper>
  );
};

export default ProfileForm;
