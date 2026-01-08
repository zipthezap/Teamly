import React from 'react';
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
  events: any[];
  groups: any[];
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
  const [expanded, setExpanded] = React.useState(true);
  const [timeFilter, setTimeFilter] = React.useState<TimeFilter>('all');
  const [activityFilter, setActivityFilter] = React.useState<ActivityFilter>('all');
  const [visibleCount, setVisibleCount] = React.useState(INITIAL_VISIBLE_COUNT);

  const generateActivities = (): Activity[] => {
    const activities: Activity[] = [];

    // Add event-related activities
    events.forEach(event => {
      // Event creation
      if (event.creatorId === userId) {
        activities.push({
          id: event.id,
          type: 'event_created',
          title: `Created event "${event.title}"`,
          timestamp: event.createdAt || event.startTime,
          relatedEntityName: event.group?.name,
          relatedEntityType: event.eventType,
        });
      }

      // Event joins
      const userParticipation = event.participants?.find((p: any) => p.userId === userId);
      if (userParticipation && event.creatorId !== userId) {
        activities.push({
          id: event.id,
          type: 'event_joined',
          title: `Joined event "${event.title}"`,
          timestamp: userParticipation.joinedAt,
          relatedEntityName: event.group?.name,
          relatedEntityType: event.eventType,
        });
      }
    });

    // Add group-related activities (simplified - in real scenario, we'd need group join/create timestamps)
    groups.slice(0, 3).forEach(group => {
      const isCreator = group.members?.find((m: any) => m.userId === userId && m.role === 'admin');
      if (isCreator) {
        activities.push({
          id: group.id,
          type: 'group_created',
          title: `Created group "${group.name}"`,
          timestamp: group.createdAt || new Date().toISOString(),
          relatedEntityName: `${group.members?.length || 0} members`,
          relatedEntityType: group.isPublic ? 'Public' : 'Private',
        });
      } else {
        activities.push({
          id: group.id,
          type: 'group_joined',
          title: `Joined group "${group.name}"`,
          timestamp: group.createdAt || new Date().toISOString(),
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

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
    <div className="bg-[#1a2233] rounded-xl shadow-md p-5">
      <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-3">
          <div className="bg-yellow-500 rounded-full w-9 h-9 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 17l6-6 4 4 6-6" /></svg>
          </div>
          <div>
            <div className="text-lg font-semibold">Recent Activity</div>
            <div className="text-xs text-gray-400">{filteredActivities.length} {filteredActivities.length === 1 ? 'activity' : 'activities'}</div>
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
            <label className="text-xs font-medium text-gray-400 mb-1.5 block">Time Range</label>
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
                      : 'bg-[#232946] text-gray-300 hover:bg-[#2a3350]'
                  }`}
                >
                  {filter === 'all' ? 'All Time' : filter === 'today' ? 'Today' : filter === 'week' ? 'This Week' : 'This Month'}
                </button>
              ))}
            </div>
          </div>

          {/* Activity Type Filter */}
          <div>
            <label className="text-xs font-medium text-gray-400 mb-1.5 block">Activity Type</label>
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
                      : 'bg-[#232946] text-gray-300 hover:bg-[#2a3350]'
                  }`}
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
                  {filter === 'all' ? 'All Types' : filter.charAt(0).toUpperCase() + filter.slice(1)}
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
            <div className="text-sm text-gray-400">No activity found</div>
            <div className="text-xs text-gray-500 mt-1">Try adjusting your filters</div>
          </div>
        ) : (
          <>
            <ul>
            {visibleActivities.map((activity, index) => (
              <React.Fragment key={`${activity.id}-${activity.type}-${activity.timestamp}`}>
                {index > 0 && <div className="my-2 border-t border-[#232946]" />}
                <li
                  className="flex items-center gap-3 p-2 rounded-lg transition hover:bg-[#232946] cursor-pointer"
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
                    <div className="flex items-center gap-2 flex-wrap text-xs text-gray-400">
                      <span>{getRelativeTime(activity.timestamp)}</span>
                      {activity.relatedEntityName && (
                        <>
                          <span>•</span>
                          <span className="px-2 py-0.5 rounded bg-[#232946] text-gray-200 text-xs font-semibold">{activity.relatedEntityName}</span>
                        </>
                      )}
                      {activity.relatedEntityType && (
                        <span className="px-2 py-0.5 rounded border border-blue-500 text-blue-400 text-xs font-semibold">{activity.relatedEntityType}</span>
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
                  className="px-4 py-2 text-xs font-medium text-blue-400 bg-[#232946] rounded-lg hover:bg-[#2a3350] transition flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M19 9l-7 7-7-7" />
                  </svg>
                  Load More ({filteredActivities.length - visibleCount} more)
                </button>
              )}
              {visibleCount > INITIAL_VISIBLE_COUNT && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleShowLess();
                  }}
                  className="px-4 py-2 text-xs font-medium text-gray-400 bg-[#232946] rounded-lg hover:bg-[#2a3350] transition flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M5 15l7-7 7 7" />
                  </svg>
                  Show Less
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
