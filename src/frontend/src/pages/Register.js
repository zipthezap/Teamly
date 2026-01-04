import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
} from '@mui/material';
import PersonAddIcon from '@mui/icons-material/PersonAdd';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { register, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const newUser = await register({ name, email, password });
      // Check for invite param
      const params = new URLSearchParams(location.search);
      const inviteGroupId = params.get('invite');
      if (inviteGroupId && newUser?.id) {
        // Call backend to join group
        try {
          await require('../services/api').groupsAPI.joinByInvite(newUser.id, inviteGroupId);
        } catch (err) {
          // Optionally handle join error
        }
        navigate(`/groups/${inviteGroupId}`);
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Box display="flex" flexDirection="column" alignItems="center">
          <PersonAddIcon sx={{ fontSize: 48, mb: 2, color: 'primary.main' }} />
          <Typography variant="h4" component="h1" gutterBottom>
            Register for Teamly
          </Typography>
          
          {error && (
            <Alert severity="error" sx={{ width: '100%', mb: 2 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit} style={{ width: '100%' }}>
            <TextField
              label="Full Name"
              fullWidth
              margin="normal"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <TextField
              label="Email"
              type="email"
              fullWidth
              margin="normal"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <TextField
              label="Password"
              type="password"
              fullWidth
              margin="normal"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <TextField
              label="Confirm Password"
              type="password"
              fullWidth
              margin="normal"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              sx={{ mt: 3, mb: 2 }}
              disabled={loading}
            >
              {loading ? 'Registering...' : 'Register'}
            </Button>
          </form>

          <Typography variant="body2" sx={{ mt: 2 }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: '#1976d2' }}>
              Login here
            </Link>
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
};

export default Register;
