import React, { useRef, useState } from 'react';
import {
  Box,
  Button,
  Avatar,
  IconButton,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';
import { PhotoCamera, Delete } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface ImageUploadProps {
  currentImage?: string;
  onUpload: (file: File) => Promise<void>;
  onDelete?: () => Promise<void>;
  label?: string;
  shape?: 'circle' | 'square';
  size?: number;
}

const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const ImageUpload: React.FC<ImageUploadProps> = ({
  currentImage,
  onUpload,
  onDelete,
  label,
  shape = 'circle',
  size = 120,
}) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string>('');

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setError('');
      
      // Validate file type
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        setError(t('common.invalidFileType') || 'Please select an image file');
        return;
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        setError(t('common.fileTooLarge') || 'File size must be less than 5MB');
        return;
      }

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Upload file
      handleUpload(file);
    }
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      await onUpload(file);
      setError('');
    } catch (error) {
      console.error('Upload failed:', error);
      setPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    
    setDeleting(true);
    setError('');
    try {
      await onDelete();
      setPreview(null);
    } catch (error) {
      console.error('Delete failed:', error);
    } finally {
      setDeleting(false);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  // Construct full image URL if picture exists and is a relative path
  const getImageUrl = (picture?: string) => {
    if (!picture) return null;
    // If picture is already a full URL, return it as is
    if (picture.startsWith('http://') || picture.startsWith('https://')) {
      return picture;
    }
    // If picture is a relative path, construct full URL
    const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    // Remove /api from the end if it exists
    const baseUrl = apiBaseUrl.replace(/\/api$/, '');
    return `${baseUrl}${picture}`;
  };

  const displayImage = preview || getImageUrl(currentImage);
  const isLoading = uploading || deleting;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      {label && (
        <Typography variant="subtitle1" fontWeight={600}>
          {label}
        </Typography>
      )}
      
      <Box sx={{ position: 'relative' }}>
        <Avatar
          src={displayImage}
          sx={{
            width: size,
            height: size,
            borderRadius: shape === 'circle' ? '50%' : '8px',
            bgcolor: 'grey.300',
          }}
          variant={shape === 'circle' ? 'circular' : 'rounded'}
        >
          {!displayImage && <PhotoCamera sx={{ fontSize: size / 2 }} />}
        </Avatar>
        
        {isLoading && (
          <CircularProgress
            size={size}
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
            }}
          />
        )}
      </Box>

      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_FILE_TYPES.join(',')}
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      {error && (
        <Alert severity="error" sx={{ width: '100%', maxWidth: 300 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button
          variant="contained"
          startIcon={<PhotoCamera />}
          onClick={handleButtonClick}
          disabled={isLoading}
          size="small"
        >
          {displayImage ? t('common.change') || 'Change' : t('common.upload') || 'Upload'}
        </Button>

        {onDelete && displayImage && (
          <IconButton
            color="error"
            onClick={handleDelete}
            disabled={isLoading}
            size="small"
          >
            <Delete />
          </IconButton>
        )}
      </Box>
    </Box>
  );
};

export default ImageUpload;
