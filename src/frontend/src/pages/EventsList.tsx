import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { eventsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import EventSearchFilters from '../components/event/EventSearchFilters';

const EventsList = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchFilters, setSearchFilters] = useState({});
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    fetchEvents();
  }, [searchFilters]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const response = await eventsAPI.getAll(searchFilters);
      setEvents(response.data);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (filters: any) => {
    setSearchFilters(filters);
  };

  const getEventStatus = (event) => {
    const now = new Date();
    const eventDate = new Date(event.startTime);
    const isFull = event.maxPlayers && event.participants?.length >= event.maxPlayers;
    const isJoined = event.participants?.some(p => p.userId === user?.id);

    if (eventDate < now) return { label: t('common.past'), color: 'default' };
    if (isFull) return { label: t('common.full'), color: 'warning' };
    if (isJoined) return { label: t('common.joined'), color: 'success' };
    return { label: t('common.open'), color: 'primary' };
  };

  // Utility to format time in 24h and round minutes to nearest 15
  function formatEventTime(dateString) {
    const date = new Date(dateString);
    let hour = date.getHours();
    let minute = date.getMinutes();
    // Round to nearest 15
    minute = Math.round(minute / 15) * 15;
    if (minute === 60) {
      minute = 0;
      hour = (hour + 1) % 24;
    }
    // Pad with zeros
    const hourStr = hour.toString().padStart(2, '0');
    const minuteStr = minute.toString().padStart(2, '0');
    return `${hourStr}:${minuteStr}`;
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[80vh]">
        <div className="w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const filteredEvents = events;

  return (
    <div className="max-w-6xl mx-auto mt-8 mb-8 px-2">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-1 text-gray-100">{t('events.allEvents')}</h1>
          <div className="text-sm text-gray-400">
            {filteredEvents.length} {filteredEvents.length !== 1 ? t('events.eventsFound') : t('events.eventFound')}
          </div>
        </div>
        <button onClick={() => navigate('/events/new')} className="bg-pink-600 hover:bg-pink-700 text-white font-medium rounded-md px-3 py-1.5 text-sm shadow transition">{t('events.createEvent')}</button>
      </div>
      
      {/* Filters and Search */}
      <EventSearchFilters onSearch={handleSearch} />
      
      {events.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-lg text-gray-400 mb-2">
            {Object.keys(searchFilters).length > 0 ? t('events.noEventsMatch') : t('events.noEventsAvailable')}
          </div>
          {Object.keys(searchFilters).length === 0 && (
            <button onClick={() => navigate('/events/new')} className="bg-pink-600 hover:bg-pink-700 text-white font-medium rounded-md px-3 py-1.5 text-sm shadow transition mt-2">{t('events.createFirstEvent')}</button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {events.map((event) => {
            const status = getEventStatus(event);
            const participantCount = event.participants?.length || 0;
            const spotsLeft = event.maxPlayers ? event.maxPlayers - participantCount : null;
            
            return (
              <div key={event.id} className="bg-[#1a202c] rounded-lg shadow-md p-4 hover:shadow-lg transition border border-gray-700">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-lg font-semibold truncate flex-1 text-gray-100">{event.title}</h3>
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ml-2 ${
                    status.label === 'Joined' ? 'bg-green-900/50 text-green-300 border border-green-700' :
                    status.label === 'Full' ? 'bg-orange-900/50 text-orange-300 border border-orange-700' :
                    status.label === 'Past' ? 'bg-gray-700 text-gray-300 border border-gray-600' :
                    'bg-blue-900/50 text-blue-300 border border-blue-700'
                  }`}>{status.label}</span>
                </div>
                
                <div className="mb-3">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-purple-900/50 text-purple-300 border border-purple-700">{event.eventType}</span>
                </div>
                
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span role="img" aria-label="date">📅</span>
                    <span className="text-xs text-gray-400">{new Date(event.startTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span role="img" aria-label="time">🕐</span>
                    <span className="text-xs text-gray-400">{formatEventTime(event.startTime)}</span>
                  </div>
                  {event.location && (
                    <div className="flex items-center gap-2">
                      <span role="img" aria-label="location">📍</span>
                      <span className="text-xs text-gray-400 truncate">{event.location}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span role="img" aria-label="participants">👥</span>
                    <span className="text-xs text-gray-400">{participantCount}{event.maxPlayers && ` / ${event.maxPlayers}`} participants</span>
                  </div>
                  {spotsLeft !== null && spotsLeft > 0 && spotsLeft <= 3 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-yellow-900/50 text-yellow-300 border border-yellow-700 mt-1">{spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} left</span>
                  )}
                </div>
                
                <button onClick={() => navigate(`/events/${event.id}`)} className="mt-4 w-full bg-pink-600 hover:bg-pink-700 text-white font-medium rounded-md px-3 py-1.5 text-sm shadow transition">View Details</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EventsList;
