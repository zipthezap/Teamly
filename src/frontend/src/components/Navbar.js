import React from 'react';
import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LogoutIcon from '@mui/icons-material/Logout';
import HomeIcon from '@mui/icons-material/Home';
import GroupIcon from '@mui/icons-material/Group';
import EventIcon from '@mui/icons-material/Event';
import PublicIcon from '@mui/icons-material/Public';
import SecurityIcon from '@mui/icons-material/Security';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 0, mr: 4 }}>
          Teamly
        </Typography>
        
        {user && (
          <Box sx={{ flexGrow: 1, display: 'flex', gap: 2 }}>
            <Button color="inherit" component={Link} to="/dashboard" startIcon={<HomeIcon />}>
              Dashboard
            </Button>
            <Button color="inherit" component={Link} to="/groups" startIcon={<GroupIcon />}>
              Groups
            </Button>
            <Button color="inherit" component={Link} to="/events" startIcon={<EventIcon />}>
              Events
            </Button>
            <Button color="inherit" component={Link} to="/public-groups" startIcon={<PublicIcon />}>
              Discover
            </Button>
          </Box>
        )}

        {user && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button color="inherit" component={Link} to="/2fa-setup" startIcon={<SecurityIcon />} size="small">
              2FA
            </Button>
            <Typography variant="body1">
              {user.name}
            </Typography>
            <Button color="inherit" onClick={handleLogout} startIcon={<LogoutIcon />}>
              Logout
            </Button>
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
