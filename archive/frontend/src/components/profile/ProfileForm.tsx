import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Paper,
  Typography,
  Box,
  TextField,
  Button,
  Grid,
} from '@mui/material';
import ImageUpload from '../ImageUpload';

interface ProfileFormProps {
  formData: {
    name: string;
    email: string;
    city: string;
    country: string;
    address: string;
    postalCode: string;
    discoveryRadius: number;
  };
  profilePicture?: string;
  loading: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onUploadPicture: (file: File) => Promise<void>;
  onDeletePicture?: () => Promise<void>;
}

const ProfileForm: React.FC<ProfileFormProps> = ({
  formData,
  profilePicture,
  loading,
  onChange,
  onSubmit,
  onUploadPicture,
  onDeletePicture,
}) => {
  const { t } = useTranslation();
  return (
    <Paper sx={{ p: { xs: 2, sm: 2.5, md: 3 } }}>
      <Typography variant="h5" gutterBottom sx={{ 
        fontWeight: 600, 
        mb: { xs: 2, sm: 3 },
        fontSize: { xs: '1.25rem', sm: '1.5rem' }
      }}>
        {t('profile.infoTitle')}
      </Typography>
      
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: { xs: 2, sm: 3 } }}>
        <ImageUpload
          currentImage={profilePicture}
          onUpload={onUploadPicture}
          onDelete={onDeletePicture}
          label={t('profile.profilePicture') || 'Profile Picture'}
          shape="circle"
          size={120}
        />
      </Box>

      <form onSubmit={onSubmit}>
        <Grid container spacing={{ xs: 2, sm: 3 }}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label={t('common.name')}
              name="name"
              value={formData.name}
              onChange={onChange}
              fullWidth
              required
              sx={{ '& .MuiInputBase-root': { minHeight: { xs: '44px', sm: '56px' } } }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label={t('common.email')}
              name="email"
              type="email"
              value={formData.email}
              onChange={onChange}
              fullWidth
              required
              sx={{ '& .MuiInputBase-root': { minHeight: { xs: '44px', sm: '56px' } } }}
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField
              label={t('profile.address') || 'Address'}
              name="address"
              value={formData.address}
              onChange={onChange}
              fullWidth
              helperText={t('profile.addressHelp') || 'Enter your address to receive notifications about nearby TeamUp opportunities'}
              sx={{ '& .MuiInputBase-root': { minHeight: { xs: '44px', sm: '56px' } } }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label={t('profile.city')}
              name="city"
              value={formData.city}
              onChange={onChange}
              fullWidth
              sx={{ '& .MuiInputBase-root': { minHeight: { xs: '44px', sm: '56px' } } }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label={t('profile.postalCode') || 'Postal Code'}
              name="postalCode"
              value={formData.postalCode}
              onChange={onChange}
              fullWidth
              sx={{ '& .MuiInputBase-root': { minHeight: { xs: '44px', sm: '56px' } } }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label={t('profile.country')}
              name="country"
              value={formData.country}
              onChange={onChange}
              fullWidth
              sx={{ '& .MuiInputBase-root': { minHeight: { xs: '44px', sm: '56px' } } }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label={t('profile.discoveryRadius') || 'Discovery Radius (km)'}
              name="discoveryRadius"
              type="number"
              value={formData.discoveryRadius}
              onChange={onChange}
              fullWidth
              inputProps={{ min: 1, max: 200 }}
              helperText={t('profile.discoveryRadiusHelp') || 'Radius for discovering nearby groups and TeamUp opportunities (1-200 km)'}
              sx={{ '& .MuiInputBase-root': { minHeight: { xs: '44px', sm: '56px' } } }}
            />
          </Grid>
        </Grid>
        <Box sx={{ mt: { xs: 2, sm: 3 } }}>
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={loading}
            sx={{ minHeight: '44px', px: { xs: 2, sm: 3 } }}
          >
            {t('profile.updateProfile')}
          </Button>
        </Box>
      </form>
    </Paper>
  );
};

export default ProfileForm;
