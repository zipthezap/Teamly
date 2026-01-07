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

const RecentActivityTimeline: React.FC<RecentActivityTimelineProps> = ({
  events,
  groups,
  userId,
  onActivityClick,
}) => {
  const [expanded, setExpanded] = React.useState(true);

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
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 8);
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

  return (
    <div className="bg-[#1a2233] rounded-xl shadow-md p-5">
      <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-3">
          <div className="bg-yellow-500 rounded-full w-9 h-9 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 17l6-6 4 4 6-6" /></svg>
          </div>
          <div className="text-lg font-semibold">Recent Activity</div>
        </div>
        <button className="focus:outline-none">
          {expanded ? (
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" /></svg>
          ) : (
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M5 15l7-7 7 7" /></svg>
          )}
        </button>
      </div>
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${expanded ? 'max-h-[600px] mt-4' : 'max-h-0'}`}
        style={{ willChange: 'max-height' }}
        aria-hidden={!expanded}
      >
        {activities.length === 0 ? (
          <div className="text-center py-6 text-sm text-gray-400">No recent activity</div>
        ) : (
          <ul>
            {activities.map((activity, index) => (
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
                  <div className={`w-8 h-8 flex items-center justify-center rounded-full ${getActivityColor(activity.type)} mr-2`}>
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
        )}
      </div>
    </div>
  );
};

export default RecentActivityTimeline;
