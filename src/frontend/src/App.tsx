import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import PrivateRoute from './components/PrivateRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import GroupsList from './pages/GroupsList';
import GroupPage from './pages/GroupPage';
import CreateGroup from './pages/CreateGroup';
import EditGroup from './pages/EditGroup';
import EventsList from './pages/EventsList';
import EventDetails from './pages/EventDetails';
import CreateEvent from './pages/CreateEvent';
import EditEvent from './pages/EditEvent';
import PublicGroups from './pages/PublicGroups';
import TwoFactorSetup from './pages/TwoFactorSetup';
import EventRequests from './pages/EventRequests';
import JoinGroup from './pages/JoinGroup';
import Profile from './pages/Profile';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Navbar />
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/public-groups" element={<PublicGroups />} />
            <Route path="/groups/join/:groupId" element={<JoinGroup />} />
            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  <Dashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/2fa-setup"
              element={
                <PrivateRoute>
                  <TwoFactorSetup />
                </PrivateRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <PrivateRoute>
                  <Profile />
                </PrivateRoute>
              }
            />
            <Route
              path="/groups"
              element={
                <PrivateRoute>
                  <GroupsList />
                </PrivateRoute>
              }
            />
            <Route
              path="/groups/new"
              element={
                <PrivateRoute>
                  <CreateGroup />
                </PrivateRoute>
              }
            />
            <Route
              path="/groups/:id"
              element={
                <PrivateRoute>
                  <GroupPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/groups/:id/edit"
              element={
                <PrivateRoute>
                  <EditGroup />
                </PrivateRoute>
              }
            />
            <Route
              path="/event-requests/:groupId"
              element={
                <PrivateRoute>
                  <EventRequests />
                </PrivateRoute>
              }
            />
            <Route
              path="/events"
              element={
                <PrivateRoute>
                  <EventsList />
                </PrivateRoute>
              }
            />
            <Route
              path="/events/new"
              element={
                <PrivateRoute>
                  <CreateEvent />
                </PrivateRoute>
              }
            />
            <Route
              path="/events/:id"
              element={
                <PrivateRoute>
                  <EventDetails />
                </PrivateRoute>
              }
            />
            <Route
              path="/events/:id/edit"
              element={
                <PrivateRoute>
                  <EditEvent />
                </PrivateRoute>
              }
            />
          </Routes>
        </Router>
      </AuthProvider>
    );
  }
  
  export default App;
