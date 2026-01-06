import React from 'react';
import {
  Paper,
  Typography,
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
} from '@mui/material';
import LinkIcon from '@mui/icons-material/Link';
import GroupIcon from '@mui/icons-material/Group';
import EventIcon from '@mui/icons-material/Event';
import PublicIcon from '@mui/icons-material/Public';
import PersonIcon from '@mui/icons-material/Person';

interface QuickLinksProps {
  onNavigate: (path: string) => void;
}

const QuickLinks: React.FC<QuickLinksProps> = ({ onNavigate }) => {
  const links = [
    {
      label: 'My Groups',
      icon: <GroupIcon sx={{ fontSize: 20 }} />,
      path: '/groups',
      color: 'primary.main',
    },
    {
      label: 'All Events',
      icon: <EventIcon sx={{ fontSize: 20 }} />,
      path: '/events',
      color: 'secondary.main',
    },
    {
      label: 'Discover Groups',
      icon: <PublicIcon sx={{ fontSize: 20 }} />,
      path: '/public-groups',
      color: 'info.main',
    },
    {
      label: 'My Profile',
      icon: <PersonIcon sx={{ fontSize: 20 }} />,
      path: '/profile',
      color: 'success.main',
    },
  ];

  return (
    <Paper sx={{ p: 2.5 }}>
      <Box display="flex" alignItems="center" gap={1.5} mb={2}>
        <Avatar sx={{ bgcolor: 'info.main', width: 36, height: 36 }}>
          <LinkIcon sx={{ fontSize: 20 }} />
        </Avatar>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Quick Links
        </Typography>
      </Box>

      <List sx={{ p: 0 }}>
        {links.map((link, index) => (
          <ListItem key={index} disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              onClick={() => onNavigate(link.path)}
              sx={{
                borderRadius: 1,
                py: 1,
                px: 1.5,
                '&:hover': {
                  bgcolor: 'rgba(0, 0, 0, 0.04)',
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                <Avatar sx={{ bgcolor: link.color, width: 28, height: 28 }}>
                  {link.icon}
                </Avatar>
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {link.label}
                  </Typography>
                }
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Paper>
  );
};

export default QuickLinks;
