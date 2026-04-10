import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  ContentCopy, 
  QrCode2, 
  Share as ShareIcon,
  WhatsApp,
  Telegram,
  Email,
  Close
} from '@mui/icons-material';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  TextField,
  Typography,
  Snackbar,
  Alert,
  Tooltip
} from '@mui/material';

interface InviteLinkCardProps {
  inviteToken: string | null;
  eventTitle: string;
  eventDate: string;
  isCreator: boolean;
  onGenerateLink: () => Promise<void>;
  isPublic: boolean;
  isPast?: boolean;
}

const InviteLinkCard: React.FC<InviteLinkCardProps> = ({
  inviteToken,
  eventTitle,
  eventDate,
  isCreator,
  onGenerateLink,
  isPublic,
  isPast = false
}) => {
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [generating, setGenerating] = useState(false);

  const inviteUrl = inviteToken 
    ? `${window.location.origin}/events/join/${inviteToken}` 
    : '';

  const handleCopyLink = async () => {
    if (inviteUrl) {
      try {
        await navigator.clipboard.writeText(inviteUrl);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 3000);
      } catch {
        // Fallback for browsers without clipboard API or when permission is denied
        // Create a temporary textarea element for fallback
        const textarea = document.createElement('textarea');
        textarea.value = inviteUrl;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
          document.execCommand('copy');
          setCopySuccess(true);
          setTimeout(() => setCopySuccess(false), 3000);
        } catch {
          // Fallback copy method failed as well
        } finally {
          document.body.removeChild(textarea);
        }
      }
    }
  };

  const handleGenerateLink = async () => {
    setGenerating(true);
    try {
      await onGenerateLink();
    } finally {
      setGenerating(false);
    }
  };

  const shareText = `Join me for ${eventTitle} on ${eventDate}!\n\nClick here to join: ${inviteUrl}`;
  
  const handleWhatsAppShare = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
  };

  const handleTelegramShare = () => {
    window.open(`https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent(`Join me for ${eventTitle}!`)}`, '_blank');
  };

  const handleEmailShare = () => {
    window.location.href = `mailto:?subject=${encodeURIComponent(`Join ${eventTitle}`)}&body=${encodeURIComponent(shareText)}`;
  };

  if (!isCreator || isPast) {
    return null;
  }

  return (
    <>
      <div className="bg-[#1a2233] rounded-lg p-5">
        <div className="font-semibold mb-3 text-lg flex items-center gap-2">
          <ShareIcon className="w-5 h-5" />
          Share Event
        </div>
        
        {!inviteToken ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-[#a1a6b4]">
              {isPublic 
                ? "Create a shareable link that allows anyone to join this event - even without an account!"
                : "Create a private invite link. Only people with this link can view and join the event."
              }
            </p>
            <Button
              variant="contained"
              color="success"
              onClick={handleGenerateLink}
              disabled={generating}
              fullWidth
            >
              {generating ? 'Generating...' : 'Generate Invite Link'}
            </Button>
            {!isPublic && (
              <Typography variant="caption" color="text.secondary">
                💡 This is a private event. The link provides controlled access without making the event publicly visible.
              </Typography>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {!isPublic && (
              <Alert severity="info" sx={{ mb: 1 }}>
                🔒 Private Event Link - Only people with this link can access
              </Alert>
            )}
            
            {/* Invite URL Display */}
            <TextField
              fullWidth
              value={inviteUrl}
              InputProps={{
                readOnly: true,
                style: { fontSize: '0.875rem' }
              }}
              size="small"
            />

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <Tooltip title="Copy link to clipboard">
                <Button
                  variant="contained"
                  onClick={handleCopyLink}
                  startIcon={<ContentCopy />}
                  fullWidth
                >
                  Copy Link
                </Button>
              </Tooltip>

              <Tooltip title="Show QR Code">
                <Button
                  variant="outlined"
                  onClick={() => setQrDialogOpen(true)}
                  startIcon={<QrCode2 />}
                  fullWidth
                >
                  QR Code
                </Button>
              </Tooltip>
            </div>

            <Tooltip title="Share via social platforms">
              <Button
                variant="outlined"
                onClick={() => setShareDialogOpen(true)}
                startIcon={<ShareIcon />}
                fullWidth
              >
                Share Options
              </Button>
            </Tooltip>

            <Typography variant="caption" color="text.secondary" className="text-center">
              {isPublic 
                ? "💡 Anyone with this link can join, even without an account"
                : "🔒 Only people with this link can access this private event"
              }
            </Typography>
          </div>
        )}
      </div>

      {/* QR Code Dialog */}
      <Dialog 
        open={qrDialogOpen} 
        onClose={() => setQrDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Scan to Join Event</Typography>
            <IconButton onClick={() => setQrDialogOpen(false)} size="small">
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box 
            display="flex" 
            flexDirection="column" 
            alignItems="center" 
            gap={2}
            py={2}
          >
            <Box 
              p={2} 
              bgcolor="white" 
              borderRadius={2}
              boxShadow={2}
            >
              <QRCodeSVG 
                value={inviteUrl}
                size={256}
                level="H"
                includeMargin
              />
            </Box>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              Share this QR code for quick event access
            </Typography>
            <Button
              variant="contained"
              onClick={handleCopyLink}
              startIcon={<ContentCopy />}
            >
              Copy Link
            </Button>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Share Options Dialog */}
      <Dialog 
        open={shareDialogOpen} 
        onClose={() => setShareDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Share Event</Typography>
            <IconButton onClick={() => setShareDialogOpen(false)} size="small">
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} py={1}>
            <Button
              variant="outlined"
              startIcon={<WhatsApp />}
              onClick={handleWhatsAppShare}
              fullWidth
              sx={{ justifyContent: 'flex-start' }}
            >
              Share on WhatsApp
            </Button>
            <Button
              variant="outlined"
              startIcon={<Telegram />}
              onClick={handleTelegramShare}
              fullWidth
              sx={{ justifyContent: 'flex-start' }}
            >
              Share on Telegram
            </Button>
            <Button
              variant="outlined"
              startIcon={<Email />}
              onClick={handleEmailShare}
              fullWidth
              sx={{ justifyContent: 'flex-start' }}
            >
              Share via Email
            </Button>
            <Box mt={2}>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                Or copy the link:
              </Typography>
              <TextField
                fullWidth
                value={inviteUrl}
                InputProps={{
                  readOnly: true,
                  endAdornment: (
                    <IconButton onClick={handleCopyLink} size="small">
                      <ContentCopy fontSize="small" />
                    </IconButton>
                  )
                }}
                size="small"
              />
            </Box>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Copy Success Snackbar */}
      <Snackbar 
        open={copySuccess} 
        autoHideDuration={3000} 
        onClose={() => setCopySuccess(false)}
      >
        <Alert severity="success" variant="filled">
          Invite link copied to clipboard!
        </Alert>
      </Snackbar>
    </>
  );
};

export default InviteLinkCard;
