import React from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme, alpha } from '@mui/material/styles';
import { EventWithDetails, GroupWithDetails, EventParticipant, GroupMember } from '../../../../shared/types';
// Removed all MUI imports; using Tailwind and SVGs

interface Activity {
  id: string;
  type: 'event_created' | 'event_joined' | 'event_left' | 'group_created' | 'group_joined';
  title: string;
  timestamp: string;
  relatedEntityName?: string;
  relatedEntityType?: string;
}

interface RecentActivityTimelineProps {
  events: EventWithDetails[];
  groups: GroupWithDetails[];
  userId?: string;
  onActivityClick?: (id: string, type: string) => void;
}

type TimeFilter = 'all' | 'today' | 'week' | 'month';
type ActivityFilter = 'all' | 'events' | 'groups';

const INITIAL_VISIBLE_COUNT = 5;
const LOAD_MORE_INCREMENT = 5;

const RecentActivityTimeline: React.FC<RecentActivityTimelineProps> = ({
  events,
  groups,
  userId,
  onActivityClick,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [expanded, setExpanded] = React.useState(true);
  const [timeFilter, setTimeFilter] = React.useState<TimeFilter>('all');
  const [activityFilter, setActivityFilter] = React.useState<ActivityFilter>('all');
  const [visibleCount, setVisibleCount] = React.useState(INITIAL_VISIBLE_COUNT);
  const { t } = useTranslation();

  const generateActivities = (): Activity[] => {
    const activities: Activity[] = [];

    // Add event-related activities
    events.forEach(event => {
      // Event creation
      if (event.creatorId === userId) {
        const timestamp = typeof event.createdAt === 'string' ? event.createdAt : 
                         event.createdAt ? new Date(event.createdAt).toISOString() :
                         typeof event.startTime === 'string' ? event.startTime : new Date(event.startTime).toISOString();
        activities.push({
          id: event.id,
          type: 'event_created',
          title: t('dashboard.activity.createdEvent', { title: event.title }),
          timestamp,
          relatedEntityName: event.group?.name,
          relatedEntityType: event.eventType,
        });
      }

      // Event joins
      const userParticipation = event.participants?.find((p: EventParticipant) => p.userId === userId);
      if (userParticipation && event.creatorId !== userId) {
        const timestamp = typeof userParticipation.joinedAt === 'string' ? userParticipation.joinedAt : 
                         new Date(userParticipation.joinedAt).toISOString();
        activities.push({
          id: event.id,
          type: 'event_joined',
          title: t('dashboard.activity.joinedEvent', { title: event.title }),
          timestamp,
          relatedEntityName: event.group?.name,
          relatedEntityType: event.eventType,
        });
      }
    });

    // Add group-related activities (simplified - in real scenario, we'd need group join/create timestamps)
    groups.slice(0, 3).forEach(group => {
      const isCreator = group.members?.find((m: GroupMember) => m.id === userId && m.role === 'admin');
      const timestamp = typeof group.createdAt === 'string' ? group.createdAt :
                       group.createdAt ? new Date(group.createdAt).toISOString() : new Date().toISOString();
      if (isCreator) {
        activities.push({
          id: group.id,
          type: 'group_created',
          title: t('dashboard.activity.createdGroup', { name: group.name }),
          timestamp,
          relatedEntityName: `${group.members?.length || 0} members`,
          relatedEntityType: group.isPublic ? 'Public' : 'Private',
        });
      } else {
        activities.push({
          id: group.id,
          type: 'group_joined',
          title: t('dashboard.activity.joinedGroup', { name: group.name }),
          timestamp,
          relatedEntityName: `${group.members?.length || 0} members`,
          relatedEntityType: group.isPublic ? 'Public' : 'Private',
        });
      }
    });

    // Sort by timestamp descending
    return activities
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  };

  const filterActivitiesByTime = (activities: Activity[]) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return activities.filter(activity => {
      const activityDate = new Date(activity.timestamp);
      switch (timeFilter) {
        case 'today':
          return activityDate >= today;
        case 'week':
          return activityDate >= weekAgo;
        case 'month':
          return activityDate >= monthAgo;
        case 'all':
        default:
          return true;
      }
    });
  };

  const filterActivitiesByType = (activities: Activity[]) => {
    if (activityFilter === 'events') {
      return activities.filter(a => a.type.includes('event'));
    } else if (activityFilter === 'groups') {
      return activities.filter(a => a.type.includes('group'));
    }
    return activities;
  };

  const getActivityIcon = (type: Activity['type']) => {
    switch (type) {
      case 'event_created':
        return (
          <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M12 8v8M8 12h8" /></svg>
        );
      case 'event_joined':
        return (
          <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-8 0v2" /><circle cx="12" cy="7" r="4" /></svg>
        );
      case 'event_left':
        return (
          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 16l4-4m0 0l-4-4m4 4H7" /><circle cx="5" cy="12" r="2" /></svg>
        );
      case 'group_created':
      case 'group_joined':
        return (
          <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-8 0v2" /><circle cx="12" cy="7" r="4" /></svg>
        );
      default:
        return null;
    }
  };

  const getActivityColor = (type: Activity['type']) => {
    const colorMap = {
      event_created: 'bg-yellow-500',
      event_joined: 'bg-green-500',
      event_left: 'bg-red-500',
      group_created: 'bg-blue-500',
      group_joined: 'bg-blue-400',
    };
    return colorMap[type];
  };

  const getRelativeTime = (timestamp: string) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000);

    if (diffInSeconds < 60) return t('dashboard.activity.justNow', 'Just now');
    if (diffInSeconds < 3600) return t('dashboard.activity.minutesAgo', { count: Math.floor(diffInSeconds / 60) });
    if (diffInSeconds < 86400) return t('dashboard.activity.hoursAgo', { count: Math.floor(diffInSeconds / 3600) });
    if (diffInSeconds < 604800) return t('dashboard.activity.daysAgo', { count: Math.floor(diffInSeconds / 86400) });
    return then.toLocaleDateString();
  };

  const getRelatedEntityTypeLabel = (type: string) => {
    if (type === 'Public' || type === 'Private') {
      return t(`groups.${type.toLowerCase()}`, type);
    }
    return t(`event.type.${type.toLowerCase()}`, type);
  };

  const activities = generateActivities();
  const filteredActivities = filterActivitiesByType(filterActivitiesByTime(activities));
  const visibleActivities = filteredActivities.slice(0, visibleCount);
  const hasMore = filteredActivities.length > visibleCount;

  const handleLoadMore = () => {
    setVisibleCount(prev => Math.min(prev + LOAD_MORE_INCREMENT, filteredActivities.length));
  };

  const handleShowLess = () => {
    setVisibleCount(INITIAL_VISIBLE_COUNT);
  };

  return (
    <div
      className="rounded-lg p-5"
      style={{
        background: alpha(theme.palette.background.paper, isDark ? 0.9 : 0.96),
        border: `1px solid ${theme.palette.divider}`,
      }}
    >
      <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-3">
          <div className="bg-yellow-500 rounded-full w-9 h-9 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 17l6-6 4 4 6-6" /></svg>
          </div>
          <div>
            <div className="text-lg font-semibold">{t('dashboard.recentActivity', 'Recent Activity')}</div>
            <div className="text-xs" style={{ color: theme.palette.text.secondary }}>{filteredActivities.length} {filteredActivities.length === 1 ? t('dashboard.activity.activity', 'activity') : t('dashboard.activity.activities', 'activities')}</div>
          </div>
        </div>
        <button className="focus:outline-none">
          {expanded ? (
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" /></svg>
          ) : (
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M5 15l7-7 7 7" /></svg>
          )}
        </button>
      </div>
      
      {/* Filters */}
      {expanded && (
        <div className="mt-4 space-y-3">
          {/* Time Filter */}
          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: theme.palette.text.secondary }}>{t('dashboard.timeRange', 'Time Range')}</label>
            <div className="flex gap-2 flex-wrap">
              {(['all', 'today', 'week', 'month'] as TimeFilter[]).map((filter) => (
                <button
                  key={filter}
                  onClick={(e) => {
                    e.stopPropagation();
                    setTimeFilter(filter);
                    setVisibleCount(INITIAL_VISIBLE_COUNT);
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                    timeFilter === filter
                      ? 'bg-blue-600 text-white'
                      : ''
                  }`}
                  style={
                    timeFilter === filter
                      ? undefined
                      : {
                          background: alpha(theme.palette.primary.main, isDark ? 0.14 : 0.08),
                          color: theme.palette.text.primary,
                        }
                  }
                >
                  {filter === 'all' ? t('dashboard.allTime', 'All Time') : filter === 'today' ? t('dashboard.today', 'Today') : filter === 'week' ? t('dashboard.thisWeek', 'This Week') : t('dashboard.thisMonth', 'This Month')}
                </button>
              ))}
            </div>
          </div>

          {/* Activity Type Filter */}
          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: theme.palette.text.secondary }}>{t('dashboard.activityType', 'Activity Type')}</label>
            <div className="flex gap-2 flex-wrap">
              {(['all', 'events', 'groups'] as ActivityFilter[]).map((filter) => (
                <button
                  key={filter}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActivityFilter(filter);
                    setVisibleCount(INITIAL_VISIBLE_COUNT);
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition flex items-center gap-1.5 ${
                    activityFilter === filter
                      ? 'bg-green-600 text-white'
                      : ''
                  }`}
                  style={
                    activityFilter === filter
                      ? undefined
                      : {
                          background: alpha(theme.palette.primary.main, isDark ? 0.14 : 0.08),
                          color: theme.palette.text.primary,
                        }
                  }
                >
                  {filter === 'events' && (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
                    </svg>
                  )}
                  {filter === 'groups' && (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M17 21v-2a4 4 0 0 0-8 0v2" /><circle cx="12" cy="7" r="4" />
                    </svg>
                  )}
                  {filter === 'all' ? t('dashboard.allTypes', 'All Types') : filter === 'events' ? t('events.events', 'Events') : t('groups.groups', 'Groups')}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${expanded ? 'max-h-[1200px] mt-4' : 'max-h-0'}`}
        style={{ willChange: 'max-height' }}
        aria-hidden={!expanded}
      >
        {visibleActivities.length === 0 ? (
          <div className="text-center py-8 px-4">
            <svg className="w-12 h-12 text-gray-500 mx-auto mb-3" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path d="M3 12h18M12 3v18" strokeLinecap="round" />
            </svg>
            <div className="text-sm" style={{ color: theme.palette.text.secondary }}>{t('dashboard.activity.noActivity', 'No activity found')}</div>
            <div className="text-xs mt-1" style={{ color: alpha(theme.palette.text.secondary, 0.8) }}>{t('dashboard.activity.tryAdjustingFilters', 'Try adjusting your filters')}</div>
          </div>
        ) : (
          <>
            <ul>
            {visibleActivities.map((activity, index) => (
              <React.Fragment key={`${activity.id}-${activity.type}-${activity.timestamp}`}>
                {index > 0 && <div className="my-2 border-t" style={{ borderColor: alpha(theme.palette.text.primary, 0.08) }} />}
                <li
                  className="flex items-center gap-3 p-2 rounded-lg transition cursor-pointer"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = alpha(theme.palette.primary.main, isDark ? 0.12 : 0.08);
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                  onClick={() => {
                    if (onActivityClick) {
                      const type = activity.type.includes('event') ? 'event' : 'group';
                      onActivityClick(activity.id, type);
                    }
                  }}
                >
                  <div className={`w-8 h-8 flex items-center justify-center rounded-full ${getActivityColor(activity.type)} mr-2 flex-shrink-0`}>
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-sm mb-0.5">{activity.title}</div>
                    <div className="flex items-center gap-2 flex-wrap text-xs" style={{ color: theme.palette.text.secondary }}>
                      <span>{getRelativeTime(activity.timestamp)}</span>
                      {activity.relatedEntityName && (
                        <>
                          <span>•</span>
                          <span
                            className="px-2 py-0.5 rounded text-xs font-semibold"
                            style={{ background: alpha(theme.palette.primary.main, isDark ? 0.16 : 0.1), color: theme.palette.text.primary }}
                          >
                            {activity.relatedEntityName}
                          </span>
                        </>
                      )}
                      {activity.relatedEntityType && (
                        <span className="px-2 py-0.5 rounded border border-blue-500 text-blue-400 text-xs font-semibold">{getRelatedEntityTypeLabel(activity.relatedEntityType)}</span>
                      )}
                    </div>
                  </div>
                </li>
              </React.Fragment>
            ))}
          </ul>
          
          {/* Load More / Show Less Buttons */}
          {filteredActivities.length > INITIAL_VISIBLE_COUNT && (
            <div className="mt-4 flex gap-2 justify-center">
              {hasMore && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLoadMore();
                  }}
                  className="px-4 py-2 text-xs font-medium rounded-lg transition flex items-center gap-2"
                  style={{
                    color: theme.palette.primary.main,
                    background: alpha(theme.palette.primary.main, isDark ? 0.16 : 0.1),
                  }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M19 9l-7 7-7-7" />
                  </svg>
                  {t('dashboard.loadMore', 'Load More')} ({filteredActivities.length - visibleCount} {t('dashboard.activity.more', 'more')})
                </button>
              )}
              {visibleCount > INITIAL_VISIBLE_COUNT && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleShowLess();
                  }}
                  className="px-4 py-2 text-xs font-medium rounded-lg transition flex items-center gap-2"
                  style={{
                    color: theme.palette.text.secondary,
                    background: alpha(theme.palette.primary.main, isDark ? 0.16 : 0.1),
                  }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M5 15l7-7 7 7" />
                  </svg>
                  {t('dashboard.activity.showLess', 'Show Less')}
                </button>
              )}
            </div>
          )}
        </>
        )}
      </div>
    </div>
  );
};

export default RecentActivityTimeline;
