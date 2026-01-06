import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Container,
  Card,
  CardContent,
  CardActions,
  Button,
  Typography,
  Box,
  CircularProgress,
  Chip,
  Alert,
  Snackbar,
  Grid,
  LinearProgress,
  Dialog,
  DialogTitle,
        <div className="grid gap-6">
          {requests.map((request) => {
            const userVote = getUserVote(request);
            const votePercentage = getVotePercentage(request);

            return (
              <div key={request.id} className="bg-white dark:bg-[#232946] rounded-xl shadow-md p-6">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-2">
                  <div className="text-lg font-semibold">{request.title}</div>
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${request.status === 'voting' ? 'bg-blue-100 text-blue-600' : request.status === 'finalized' ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-600'}`}>{request.status}</span>
                </div>

                {request.description && (
                  <div className="text-sm text-gray-400 mb-2">{request.description}</div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2 text-xs text-gray-400">
                  <div>Type: {request.eventType}</div>
                  <div>Location: {request.location || 'TBD'}</div>
                  <div>Start: {new Date(request.startTime).toLocaleString()}</div>
                  {request.maxPlayers && <div>Max Players: {request.maxPlayers}</div>}
                </div>

                {request.status === 'voting' && (
                  <>
                    <div className="mb-2">
                      <div className="flex justify-between text-xs mb-1">
                        <span>Yes: {request.yesVotes} | No: {request.noVotes}</span>
                        <span>{votePercentage.toFixed(0)}% approval</span>
                      </div>
                      <div className="w-full h-2 bg-gray-200 rounded">
                        <div
                          className={`h-2 rounded ${votePercentage >= 50 ? 'bg-green-500' : 'bg-red-500'}`}
                          style={{ width: `${votePercentage}%` }}
                        />
                      </div>
                    </div>
                    {userVote && (
                      <div className="bg-blue-50 text-blue-700 px-3 py-2 rounded mb-2 text-xs font-semibold">You voted: {userVote === 'yes' ? 'Yes' : 'No'}</div>
                    )}
                  </>
                )}

                <div className="flex flex-wrap gap-2 mt-2">
                  {request.status === 'voting' && (
                    <>
                      <button
                        className={`inline-flex items-center gap-1 px-4 py-2 rounded font-semibold border transition text-sm ${userVote === 'yes' ? 'bg-green-600 text-white border-green-600' : 'border-green-500 text-green-600 hover:bg-green-50'}`}
                        onClick={() => handleVote(request.id, 'yes')}
                        disabled={voting[request.id]}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 9V5a3 3 0 0 0-6 0v4" /><path d="M5 12h14" /><path d="M7 12v7a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-7" /></svg>
                        Yes
                      </button>
                      <button
                        className={`inline-flex items-center gap-1 px-4 py-2 rounded font-semibold border transition text-sm ${userVote === 'no' ? 'bg-red-600 text-white border-red-600' : 'border-red-500 text-red-600 hover:bg-red-50'}`}
                        onClick={() => handleVote(request.id, 'no')}
                        disabled={voting[request.id]}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M10 15V5a3 3 0 0 1 6 0v10" /><path d="M19 12H5" /></svg>
                        No
                      </button>
                      {isAdmin && (
                        <>
                          <button
                            className="inline-flex items-center gap-1 px-4 py-2 rounded font-semibold border border-blue-500 text-blue-600 hover:bg-blue-50 transition text-sm"
                            onClick={() => handleFinalize(request.id)}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M9 12l2 2l4-4" /></svg>
                            Finalize
                          </button>
                          <button
                            className="inline-flex items-center gap-1 px-4 py-2 rounded font-semibold border border-red-500 text-red-600 hover:bg-red-50 transition text-sm"
                            onClick={() => handleCancel(request.id)}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" /></svg>
                            Cancel
                          </button>
                        </>
                      )}
                    </>
                  )}
                  {request.status === 'finalized' && (
                    <div className="bg-green-50 text-green-700 px-3 py-2 rounded text-xs font-semibold w-full">Event created successfully!</div>
                  )}
                  {request.status === 'cancelled' && (
                    <div className="bg-red-50 text-red-700 px-3 py-2 rounded text-xs font-semibold w-full">Request cancelled</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
        message: error.response?.data?.error || 'Failed to create event request',
        severity: 'error',
      });
    }
  };

  const isAdmin = group?.members?.some(
    (m) => m.userId === user?.id && m.role === 'admin'
  );

  const getVotePercentage = (request) => {
    const total = request.yesVotes + request.noVotes;
    if (total === 0) return 0;
    return (request.yesVotes / total) * 100;
  };

  const getUserVote = (request) => {
    return request.votes?.find((v) => v.userId === user?.id)?.vote;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[80vh]">
        <svg className="animate-spin text-blue-500" width={48} height={48} viewBox="0 0 50 50" fill="none"><circle className="opacity-20" cx="25" cy="25" r="20" stroke="currentColor" strokeWidth="6" /><path className="opacity-80" d="M45 25c0-11.046-8.954-20-20-20" stroke="currentColor" strokeWidth="6" strokeLinecap="round" /></svg>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto mt-8 mb-8 px-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <div className="text-2xl font-bold mb-1">Event Requests</div>
          {group && (
            <div className="text-sm text-gray-400">{group.name}</div>
          )}
        </div>
        {isAdmin && (
          <button
            className="inline-flex items-center gap-2 px-4 py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 transition text-sm"
            onClick={() => setCreateDialogOpen(true)}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 8v8M8 12h8" /></svg>
            Create Event Request
          </button>
        )}
      </div>

      {requests.length === 0 ? (
        <div className="text-center py-16">
          <svg className="mx-auto mb-4 w-16 h-16 text-gray-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 17v-6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6" /><path d="M12 19v2" /><circle cx="12" cy="12" r="10" /></svg>
          <div className="text-lg text-gray-400 font-semibold mb-2">No event requests yet</div>
          <div className="text-sm text-gray-400">
            {isAdmin
              ? 'Create an event request for members to vote on!'
              : 'Check back later for new event proposals'}
          </div>
        </div>
      ) : (
        <Grid container spacing={3}>
          {requests.map((request) => {
            const userVote = getUserVote(request);
            const votePercentage = getVotePercentage(request);

            return (
              <Grid item xs={12} key={request.id}>
                <Card>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                      <Typography variant="h6">{request.title}</Typography>
                      <Chip
                        label={request.status}
                        color={
                          request.status === 'voting'
                            ? 'info'
                            : request.status === 'finalized'
                            ? 'success'
                            : 'default'
                        }
                        size="small"
                      />
                    </Box>

                    {request.description && (
                      <Typography variant="body2" color="text.secondary" paragraph>
                        {request.description}
                      </Typography>
                    )}

                    <Grid container spacing={2} sx={{ mb: 2 }}>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="caption" color="text.secondary">
                          Type: {request.eventType}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="caption" color="text.secondary">
                          Location: {request.location || 'TBD'}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="caption" color="text.secondary">
                          Start: {new Date(request.startTime).toLocaleString()}
                        </Typography>
                      </Grid>
                      {request.maxPlayers && (
                        <Grid item xs={12} sm={6}>
                          <Typography variant="caption" color="text.secondary">
                            Max Players: {request.maxPlayers}
                          </Typography>
                        </Grid>
                      )}
                    </Grid>

                    {request.status === 'voting' && (
                      <>
                        <Box sx={{ mb: 1 }}>
                          <Box display="flex" justifyContent="space-between" mb={0.5}>
                            <Typography variant="body2">
                              Yes: {request.yesVotes} | No: {request.noVotes}
                            </Typography>
                            <Typography variant="body2">
                              {votePercentage.toFixed(0)}% approval
                            </Typography>
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={votePercentage}
                            color={votePercentage >= 50 ? 'success' : 'error'}
                          />
                        </Box>

                        {userVote && (
                          <Alert severity="info" sx={{ mb: 2 }}>
                            You voted: {userVote === 'yes' ? 'Yes' : 'No'}
                          </Alert>
                        )}
                      </>
                    )}
                  </CardContent>

                  <CardActions>
                    {request.status === 'voting' && (
                      <>
                        <Button
                          size="small"
                          variant={userVote === 'yes' ? 'contained' : 'outlined'}
                          startIcon={<ThumbUpIcon />}
                          onClick={() => handleVote(request.id, 'yes')}
                          disabled={voting[request.id]}
                          color="success"
                        >
                          Yes
                        </Button>
                        <Button
                          size="small"
                          variant={userVote === 'no' ? 'contained' : 'outlined'}
                          startIcon={<ThumbDownIcon />}
                          onClick={() => handleVote(request.id, 'no')}
                          disabled={voting[request.id]}
                          color="error"
                        >
                          No
                        </Button>
                        {isAdmin && (
                          <>
                            <Box sx={{ flexGrow: 1 }} />
                            <Button
                              size="small"
                              variant="contained"
                              startIcon={<CheckCircleIcon />}
                              onClick={() => handleFinalize(request.id)}
                            >
                              Finalize
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<CancelIcon />}
                              onClick={() => handleCancel(request.id)}
                              color="error"
                            >
                              Cancel
                            </Button>
                          </>
                        )}
                      </>
                    )}
                    {request.status === 'finalized' && (
                      <Alert severity="success" sx={{ width: '100%' }}>
                        Event created successfully!
                      </Alert>
                    )}
                    {request.status === 'cancelled' && (
                      <Alert severity="error" sx={{ width: '100%' }}>
                        Request cancelled
                      </Alert>
                    )}
                  </CardActions>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Create Event Request Dialog */}
      {createDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white dark:bg-[#232946] rounded-xl shadow-lg p-6 w-full max-w-md">
            <div className="text-lg font-semibold mb-4">Create Event Request</div>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Title"
                value={newRequest.title}
                onChange={e => setNewRequest({ ...newRequest, title: e.target.value })}
                className="w-full px-3 py-2 rounded border border-gray-200 dark:border-[#232946] bg-white dark:bg-[#232946] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <textarea
                placeholder="Description"
                value={newRequest.description}
                onChange={e => setNewRequest({ ...newRequest, description: e.target.value })}
                className="w-full px-3 py-2 rounded border border-gray-200 dark:border-[#232946] bg-white dark:bg-[#232946] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
              <select
                value={newRequest.eventType}
                onChange={e => setNewRequest({ ...newRequest, eventType: e.target.value })}
                className="w-full px-3 py-2 rounded border border-gray-200 dark:border-[#232946] bg-white dark:bg-[#232946] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                {eventTypes.map((type) => (
                  <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Location"
                value={newRequest.location}
                onChange={e => setNewRequest({ ...newRequest, location: e.target.value })}
                className="w-full px-3 py-2 rounded border border-gray-200 dark:border-[#232946] bg-white dark:bg-[#232946] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="datetime-local"
                placeholder="Start Time"
                value={newRequest.startTime}
                onChange={e => setNewRequest({ ...newRequest, startTime: e.target.value })}
                className="w-full px-3 py-2 rounded border border-gray-200 dark:border-[#232946] bg-white dark:bg-[#232946] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <input
                type="datetime-local"
                placeholder="End Time"
                value={newRequest.endTime}
                onChange={e => setNewRequest({ ...newRequest, endTime: e.target.value })}
                className="w-full px-3 py-2 rounded border border-gray-200 dark:border-[#232946] bg-white dark:bg-[#232946] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="number"
                placeholder="Max Players"
                value={newRequest.maxPlayers}
                onChange={e => setNewRequest({ ...newRequest, maxPlayers: e.target.value })}
                className="w-full px-3 py-2 rounded border border-gray-200 dark:border-[#232946] bg-white dark:bg-[#232946] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                className="px-4 py-2 rounded bg-gray-200 text-gray-700 font-semibold hover:bg-gray-300 transition"
                onClick={() => setCreateDialogOpen(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
                onClick={handleCreateRequest}
                disabled={!newRequest.title || !newRequest.startTime}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Snackbar */}
      {snackbar.open && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
          <div className={`px-6 py-3 rounded shadow-lg animate-fade-in text-white font-semibold ${snackbar.severity === 'success' ? 'bg-green-600' : snackbar.severity === 'error' ? 'bg-red-600' : 'bg-blue-600'}`}>
            {snackbar.message}
          </div>
        </div>
      )}
    </div>
  );
};

export default EventRequests;
