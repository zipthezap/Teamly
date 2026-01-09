import React, { useRef, useState } from 'react';
import {
  Box,
  Button,
  Avatar,
  IconButton,
  Typography,
  CircularProgress,
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

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert(t('common.invalidFileType') || 'Please select an image file');
        return;
      }

      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert(t('common.fileTooLarge') || 'File size must be less than 5MB');
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

  const displayImage = preview || currentImage;
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
        accept="image/jpeg,image/jpg,image/png,image/webp"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

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
