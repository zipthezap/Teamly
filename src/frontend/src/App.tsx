import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import PrivateRoute from './components/PrivateRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import AuthCallback from './pages/AuthCallback';
import Dashboard from './pages/Dashboard';
import GroupsList from './pages/GroupsList';
import GroupDetailsPage from './pages/GroupDetailsPage';
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
import JoinEventByInvite from './pages/JoinEventByInvite';
import Profile from './pages/Profile';
import NotificationsCenter from './pages/NotificationsCenter';
import TeamUp from './pages/TeamUp';
import TournamentsList from './pages/TournamentsList';
import CreateTournament from './pages/CreateTournament';
import TournamentDetails from './pages/TournamentDetails';
import TournamentTeamDetails from './pages/TournamentTeamDetails';

function App() {
  return (
      <Router>
        <Navbar />
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/public-groups" element={<PublicGroups />} />
            <Route path="/join-group/:groupId" element={<JoinGroup />} />
            <Route path="/events/join/:token" element={<JoinEventByInvite />} />
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
              path="/notifications"
              element={
                <PrivateRoute>
                  <NotificationsCenter />
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
                  <GroupDetailsPage />
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
            <Route
              path="/teamup"
              element={
                <PrivateRoute>
                  <TeamUp />
                </PrivateRoute>
              }
            />
            <Route
              path="/tournaments"
              element={
                <PrivateRoute>
                  <TournamentsList />
                </PrivateRoute>
              }
            />
            <Route
              path="/tournaments/create"
              element={
                <PrivateRoute>
                  <CreateTournament />
                </PrivateRoute>
              }
            />
            <Route
              path="/tournaments/:id"
              element={
                <PrivateRoute>
                  <TournamentDetails />
                </PrivateRoute>
              }
            />
            <Route
              path="/tournaments/:id/teams/:teamId"
              element={
                <PrivateRoute>
                  <TournamentTeamDetails />
                </PrivateRoute>
              }
            />
          </Routes>
        </Router>
    );
  }
  
  export default App;
