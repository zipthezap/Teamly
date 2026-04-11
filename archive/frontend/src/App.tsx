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
import SessionsList from './pages/SessionsList';
import SessionDetails from './pages/SessionDetails';
import CreateSession from './pages/CreateSession';
import EditSession from './pages/EditSession';
import PublicGroups from './pages/PublicGroups';
import TwoFactorSetup from './pages/TwoFactorSetup';
import SessionRequests from './pages/SessionRequests';
import JoinGroup from './pages/JoinGroup';
import JoinSessionByInvite from './pages/JoinSessionByInvite';
import Profile from './pages/Profile';
import NotificationsCenter from './pages/NotificationsCenter';
import TeamUp from './pages/TeamUp';
import TournamentsList from './pages/TournamentsList';
import CreateTournament from './pages/CreateTournament';
import TournamentDetails from './pages/TournamentDetails';
import TournamentTeamDetails from './pages/TournamentTeamDetails';
import LeaguesList from './pages/LeaguesList';
import LeagueDetails from './pages/LeagueDetails';
import CreateLeague from './pages/CreateLeague';

function App() {
  return (
      <Router>
        <Navbar />
        <main style={{ minHeight: 'calc(100vh - 64px)' }}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/public-groups" element={<PublicGroups />} />
            <Route path="/join-group/:groupId" element={<JoinGroup />} />
            <Route path="/sessions/join/:token" element={<JoinSessionByInvite />} />
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
              path="/session-requests/:groupId"
              element={
                <PrivateRoute>
                  <SessionRequests />
                </PrivateRoute>
              }
            />
            <Route
              path="/sessions"
              element={
                <PrivateRoute>
                  <SessionsList />
                </PrivateRoute>
              }
            />
            <Route
              path="/sessions/new"
              element={
                <PrivateRoute>
                  <CreateSession />
                </PrivateRoute>
              }
            />
            <Route
              path="/sessions/:id"
              element={
                <PrivateRoute>
                  <SessionDetails />
                </PrivateRoute>
              }
            />
            <Route
              path="/sessions/:id/edit"
              element={
                <PrivateRoute>
                  <EditSession />
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
            <Route
              path="/leagues"
              element={
                <PrivateRoute>
                  <LeaguesList />
                </PrivateRoute>
              }
            />
            <Route
              path="/leagues/new"
              element={
                <PrivateRoute>
                  <CreateLeague />
                </PrivateRoute>
              }
            />
            <Route
              path="/leagues/:id"
              element={
                <PrivateRoute>
                  <LeagueDetails />
                </PrivateRoute>
              }
            />
          </Routes>
        </main>
        </Router>
    );
  }
  
  export default App;
