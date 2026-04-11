import React from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme, alpha } from '@mui/material/styles';
import { SessionWithDetails } from '../../../../shared/types';
// Removed all MUI imports; using Tailwind and SVGs

interface UpcomingSessionsCalendarProps {
  events: SessionWithDetails[];
  onEventClick: (eventId: string) => void;
  userId?: string;
}

const UpcomingSessionsCalendar: React.FC<UpcomingSessionsCalendarProps> = ({ events, onEventClick, userId }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const getEventColor = (eventType: string) => {
    const colors: Record<string, string> = {
      football: '#4CAF50',
      basketball: '#FF9800',
      cricket: '#FFB300',
      americanFootball: '#795548',
      iceHockey: '#00ACC1',
      baseball: '#F44336',
      volleyball: '#9C27B0',
      rugby: '#689F38',
      handball: '#E91E63',
      fieldHockey: '#009688',
      tennis: '#2196F3',
      running: '#FF5722',
      cycling: '#00BCD4',
      swimming: '#3F51B5',
      other: '#607D8B',
    };
    return colors[eventType] || colors.other;
  };

  const getEventTypeLabel = (eventType: string) => {
    return t(`event.type.${eventType.toLowerCase()}`, eventType);
  };

  const getDayInfo = (dateString: string | Date) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return { label: t('dashboard.today', 'Today'), color: 'success' as const };
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return { label: t('dashboard.tomorrow', 'Tomorrow'), color: 'info' as const };
    } else {
      const daysUntil = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntil <= 7) {
        return { label: date.toLocaleDateString(), color: 'default' as const };
      }
      return { label: date.toLocaleDateString(), color: 'default' as const };
    }
  };

  const upcomingEvents = events
    .filter(e => {
      const isFuture = new Date(e.startTime) > new Date();
      if (!isFuture) return false;
      
      // Show if user is the organizer
      if (e.creatorId === userId) return true;
      
      // Show if user is a confirmed participant
      const isConfirmed = e.participants?.some(p => p.userId === userId && p.status === 'confirmed');
      return isConfirmed;
    })
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .slice(0, 5);

  const [open, setOpen] = React.useState(true);
  return (
    <div
      className="rounded-lg p-3 sm:p-5 h-full"
      style={{
        background: alpha(theme.palette.background.paper, isDark ? 0.9 : 0.96),
        border: `1px solid ${theme.palette.divider}`,
      }}
    >
      <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-4">
        <div className="bg-blue-600 rounded-full w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
        </div>
          <div className="text-sm sm:text-lg font-semibold flex-1" style={{ color: theme.palette.text.primary }}>{t('dashboard.upcomingSchedule', 'Upcoming Schedule')}</div>
        <button className="focus:outline-none" onClick={() => setOpen((v) => !v)} aria-label={open ? 'Collapse' : 'Expand'}>
          {open ? (
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" /></svg>
          ) : (
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M5 15l7-7 7 7" /></svg>
          )}
        </button>
      </div>
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${open ? 'max-h-[600px]' : 'max-h-0'}`}
        style={{ willChange: 'max-height' }}
        aria-hidden={!open}
      >
        {upcomingEvents.length === 0 ? (
          <div className="text-center py-6 text-sm" style={{ color: theme.palette.text.secondary }}>{t('dashboard.noUpcomingEvents', 'No upcoming events scheduled')}</div>
        ) : (
          <ul>
            {upcomingEvents.map((event, _index) => {
              const dayInfo = getDayInfo(event.startTime);
              const eventDate = new Date(event.startTime);
              const participantCount = event.participants?.length || 0;
              const isFull = event.maxPlayers && participantCount >= event.maxPlayers;

              return (
                <li
                  key={event.id}
                  className="flex items-start py-2 sm:py-3 cursor-pointer rounded-lg transition"
                  style={{ borderTop: _index === 0 ? 'none' : `1px solid ${alpha(theme.palette.text.primary, 0.08)}` }}
                  onClick={() => onEventClick(event.id)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = alpha(theme.palette.primary.main, isDark ? 0.12 : 0.08);
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <div className="w-1 sm:w-1.5 h-10 sm:h-14 rounded bg-opacity-80 mr-2 sm:mr-4 flex-shrink-0" style={{ background: getEventColor(event.eventType) }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
                      <span className="font-semibold text-sm sm:text-base flex-1 truncate">{event.title}</span>
                      <span className={`px-1.5 py-0 sm:px-2 sm:py-0.5 rounded text-xs font-medium flex-shrink-0 ${dayInfo.color === 'success' ? 'bg-green-500 text-white' : dayInfo.color === 'info' ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-200'}`}>{dayInfo.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 text-xs" style={{ color: theme.palette.text.secondary }}>
                      <svg className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                      <span>{eventDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                      <span>•</span>
                      <span className="px-1.5 py-0 rounded text-xs font-semibold" style={{ background: getEventColor(event.eventType), color: 'white' }}>{getEventTypeLabel(event.eventType)}</span>
                      {isFull && (
                        <span className="px-1.5 rounded bg-yellow-500 text-white text-xs font-semibold">{t('common.full', 'Full')}</span>
                      )}
                    </div>
                    {event.location && (
                      <div className="hidden sm:flex items-center gap-1 text-xs mt-0.5" style={{ color: theme.palette.text.secondary }}>
                        <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z" /></svg>
                        <span className="truncate">{event.location}</span>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
      )}
      </div>
    </div>
  );
};

export default UpcomingSessionsCalendar;
