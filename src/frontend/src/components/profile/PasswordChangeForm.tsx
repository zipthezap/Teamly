import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  Box,
  Stack,
} from '@mui/material';

interface PasswordChangeFormProps {
  passwordData: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  };
  loading: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
}

const PasswordChangeForm: React.FC<PasswordChangeFormProps> = ({
  passwordData,
  loading,
  onChange,
  onSubmit,
}) => {
  const { t } = useTranslation();
  return (
    <Paper sx={{ p: 4 }}>
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
        {t('profile.changePassword')}
      </Typography>
      <form onSubmit={onSubmit}>
        <Stack spacing={3}>
          <TextField
            label={t('profile.currentPassword')}
            name="currentPassword"
            type="password"
            value={passwordData.currentPassword}
            onChange={onChange}
            fullWidth
            required
          />
          <TextField
            label={t('profile.newPassword')}
            name="newPassword"
            type="password"
            value={passwordData.newPassword}
            onChange={onChange}
            fullWidth
            required
            helperText={t('profile.passwordMinLength')}
          />
          <TextField
            label={t('profile.confirmNewPassword')}
            name="confirmPassword"
            type="password"
            value={passwordData.confirmPassword}
            onChange={onChange}
            fullWidth
            required
          />
        </Stack>
        <Box sx={{ mt: 3 }}>
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={loading}
          >
            {t('profile.updatePassword')}
          </Button>
        </Box>
      </form>
    </Paper>
  );
};

export default PasswordChangeForm;
