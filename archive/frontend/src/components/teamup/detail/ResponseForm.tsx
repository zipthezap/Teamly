import React from 'react';
import { Box, TextField, Button } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { useTranslation } from 'react-i18next';

interface ResponseFormProps {
  message: string;
  onMessageChange: (value: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  spotsLeft: number;
  isOwnRequest: boolean;
}

export const ResponseForm: React.FC<ResponseFormProps> = ({
  message,
  onMessageChange,
  onSubmit,
  isSubmitting,
  spotsLeft,
  isOwnRequest
}) => {
  const { t } = useTranslation();

  if (isOwnRequest || spotsLeft === 0) {
    return null;
  }

  return (
    <Box sx={{ mb: 3, mt: 3 }}>
      <TextField
        fullWidth
        multiline
        rows={3}
        placeholder={t('teamup.enterMessage')}
        value={message}
        onChange={(e) => onMessageChange(e.target.value)}
        variant="outlined"
        disabled={isSubmitting}
        sx={{
          mb: 2,
          '& .MuiOutlinedInput-root': {
            '&:hover fieldset': {
              borderColor: '#2196f3'
            },
            '&.Mui-focused fieldset': {
              borderColor: '#2196f3'
            }
          }
        }}
      />
      <Button
        fullWidth
        variant="contained"
        onClick={onSubmit}
        disabled={isSubmitting || spotsLeft === 0}
        startIcon={<SendIcon />}
        sx={{
          background: '#2196f3',
          color: 'white',
          fontWeight: 600,
          textTransform: 'none',
          py: 1.5,
          fontSize: '1rem',
          boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
          transition: 'all 0.3s ease',
          '&:hover': {
            background: 'linear-gradient(135deg, #5568d3 0%, #6a3d8f 100%)',
            transform: 'translateY(-2px)',
            boxShadow: '0 6px 16px rgba(102, 126, 234, 0.5)'
          },
          '&:disabled': {
            background: 'grey.300',
            color: 'grey.500'
          }
        }}
      >
        {isSubmitting ? t('common.sending') : t('teamup.sendResponse')}
      </Button>
    </Box>
  );
};
