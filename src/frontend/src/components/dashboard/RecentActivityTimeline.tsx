import React from 'react';
import {
  Paper,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  Avatar,
  Collapse,
  IconButton,
  Divider,
  Chip,
} from '@mui/material';
import TimelineIcon from '@mui/icons-material/Timeline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import EventIcon from '@mui/icons-material/Event';

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
    const iconMap = {
      event_created: <AddCircleIcon sx={{ fontSize: 18 }} />,
      event_joined: <PersonAddIcon sx={{ fontSize: 18 }} />,
      event_left: <ExitToAppIcon sx={{ fontSize: 18 }} />,
      group_created: <GroupAddIcon sx={{ fontSize: 18 }} />,
      group_joined: <GroupAddIcon sx={{ fontSize: 18 }} />,
    };
    return iconMap[type];
  };

  const getActivityColor = (type: Activity['type']) => {
    const colorMap = {
      event_created: 'secondary.main',
      event_joined: 'success.main',
      event_left: 'error.main',
      group_created: 'primary.main',
      group_joined: 'info.main',
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
    <Paper sx={{ p: 2.5 }}>
      <Box 
        display="flex" 
        alignItems="center" 
        justifyContent="space-between"
        sx={{ cursor: 'pointer' }}
        onClick={() => setExpanded(!expanded)}
      >
        <Box display="flex" alignItems="center" gap={1.5}>
          <Avatar sx={{ bgcolor: 'warning.main', width: 36, height: 36 }}>
            <TimelineIcon sx={{ fontSize: 20 }} />
          </Avatar>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Recent Activity
          </Typography>
        </Box>
        <IconButton size="small">
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>

      <Collapse in={expanded}>
        <Box sx={{ mt: 2 }}>
          {activities.length === 0 ? (
            <Box textAlign="center" py={3}>
              <Typography variant="body2" color="text.secondary">
                No recent activity
              </Typography>
            </Box>
          ) : (
            <List sx={{ p: 0 }}>
              {activities.map((activity, index) => (
                <React.Fragment key={`${activity.type}-${activity.id}-${index}`}>
                  {index > 0 && <Divider sx={{ my: 1 }} />}
                  <ListItem
                    sx={{
                      p: 1,
                      cursor: 'pointer',
                      borderRadius: 1,
                      transition: 'all 0.2s',
                      '&:hover': {
                        bgcolor: 'rgba(0, 0, 0, 0.02)',
                      },
                    }}
                    onClick={() => {
                      if (onActivityClick) {
                        const type = activity.type.includes('event') ? 'event' : 'group';
                        onActivityClick(activity.id, type);
                      }
                    }}
                  >
                    <Avatar
                      sx={{
                        bgcolor: getActivityColor(activity.type),
                        width: 32,
                        height: 32,
                        mr: 1.5,
                      }}
                    >
                      {getActivityIcon(activity.type)}
                    </Avatar>
                    <ListItemText
                      primary={
                        <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.3 }}>
                          {activity.title}
                        </Typography>
                      }
                      secondary={
                        <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                          <Typography variant="caption" color="text.secondary">
                            {getRelativeTime(activity.timestamp)}
                          </Typography>
                          {activity.relatedEntityName && (
                            <>
                              <Typography variant="caption" color="text.secondary">•</Typography>
                              <Chip
                                label={activity.relatedEntityName}
                                size="small"
                                sx={{ height: 18, fontSize: '0.65rem' }}
                              />
                            </>
                          )}
                          {activity.relatedEntityType && (
                            <Chip
                              label={activity.relatedEntityType}
                              size="small"
                              color="primary"
                              variant="outlined"
                              sx={{ height: 18, fontSize: '0.65rem' }}
                            />
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                </React.Fragment>
              ))}
            </List>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
};

export default RecentActivityTimeline;
