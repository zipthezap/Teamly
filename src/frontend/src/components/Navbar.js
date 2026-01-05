import React from 'react';
import { AppBar, Toolbar, Typography, Button, Box, Avatar, IconButton } from '@mui/material';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LogoutIcon from '@mui/icons-material/Logout';
import HomeIcon from '@mui/icons-material/Home';
import GroupIcon from '@mui/icons-material/Group';
import EventIcon from '@mui/icons-material/Event';
import PublicIcon from '@mui/icons-material/Public';
import SecurityIcon from '@mui/icons-material/Security';
import SportsIcon from '@mui/icons-material/Sports';
import JoinRequestsPopover from './JoinRequestsPopover';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <AppBar 
      position="static" 
      elevation={0}
      sx={{ 
        background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #2563eb 100%)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      }}
    >
      <Toolbar sx={{ py: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 0, mr: 4 }}>
          <SportsIcon sx={{ fontSize: 32, mr: 1 }} />
          <Typography 
            variant="h5" 
            component="div" 
            sx={{ 
              fontWeight: 700,
              letterSpacing: '0.05em',
              background: 'linear-gradient(45deg, #fff 30%, #60a5fa 90%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Teamly
          </Typography>
        </Box>
        
        {user && (
          <Box sx={{ flexGrow: 1, display: 'flex', gap: 1 }}>
            <Button 
              color="inherit" 
              component={Link} 
              to="/dashboard" 
              startIcon={<HomeIcon />}
              sx={{ 
                textTransform: 'none',
                fontWeight: 500,
                px: 2,
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                }
              }}
            >
              Dashboard
            </Button>
            <Button 
              color="inherit" 
              component={Link} 
              to="/groups" 
              startIcon={<GroupIcon />}
              sx={{ 
                textTransform: 'none',
                fontWeight: 500,
                px: 2,
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                }
              }}
            >
              Groups
            </Button>
            <Button 
              color="inherit" 
              component={Link} 
              to="/events" 
              startIcon={<EventIcon />}
              sx={{ 
                textTransform: 'none',
                fontWeight: 500,
                px: 2,
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                }
              }}
            >
              Events
            </Button>
            <Button 
              color="inherit" 
              component={Link} 
              to="/public-groups" 
              startIcon={<PublicIcon />}
              sx={{ 
                textTransform: 'none',
                fontWeight: 500,
                px: 2,
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                }
              }}
            >
              Discover
            </Button>
          </Box>
        )}

        {user && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <JoinRequestsPopover />
            
            <IconButton 
              color="inherit" 
              component={Link} 
              to="/2fa-setup"
              size="small"
              sx={{ 
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                }
              }}
            >
              <SecurityIcon />
            </IconButton>
            
            <Box 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1.5,
                px: 2,
                py: 0.5,
                borderRadius: 2,
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
              }}
            >
              <Avatar 
                sx={{ 
                  width: 32, 
                  height: 32,
                  bgcolor: 'secondary.main',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                }}
              >
                {getInitials(user.name)}
              </Avatar>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                {user.name}
              </Typography>
            </Box>
            
            <Button 
              color="inherit" 
              onClick={handleLogout} 
              startIcon={<LogoutIcon />}
              sx={{ 
                textTransform: 'none',
                fontWeight: 500,
                px: 2,
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                }
              }}
            >
              Logout
            </Button>
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
