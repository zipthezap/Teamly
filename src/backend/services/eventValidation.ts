/**
 * Event Validation Service
 * Handles all event-related validation logic
 */

interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates that events are single-day only
 */
export const validateSingleDay = (startTime: string, endTime?: string): ValidationResult => {
  if (!endTime) {
    return { isValid: true };
  }

  const startDate = new Date(startTime);
  const endDate = new Date(endTime);
  
  // Check if they're on the same day by comparing year, month, and day
  const isSameDay = startDate.getFullYear() === endDate.getFullYear() &&
                    startDate.getMonth() === endDate.getMonth() &&
                    startDate.getDate() === endDate.getDate();
  
  if (!isSameDay) {
    return { 
      isValid: false, 
      error: 'Events must be single-day only. Start and end times must be on the same day.' 
    };
  }
  
  // Check that end time is after start time
  if (endDate <= startDate) {
    return { 
      isValid: false, 
      error: 'End time must be after start time.' 
    };
  }

  return { isValid: true };
};

/**
 * Validates required event fields
 */
export const validateRequiredFields = (data: {
  groupId?: string;
  title?: string;
  eventType?: string;
  startTime?: string;
}): ValidationResult => {
  const { groupId, title, eventType, startTime } = data;
  
  if (!groupId || !title || !eventType || !startTime) {
    return { 
      isValid: false, 
      error: 'Group ID, title, event type, and start time are required' 
    };
  }

  return { isValid: true };
};

/**
 * Validates that a user is a member of a group
 */
export const validateGroupMembership = async (
  groupId: string,
  userId: string,
  prisma: {
    groupMember: {
      findFirst: (args: {
        where: { groupId: string; userId: string };
      }) => Promise<unknown>;
    };
  }
): Promise<ValidationResult> => {
  const membership = await prisma.groupMember.findFirst({
    where: {
      groupId,
      userId
    }
  });

  if (!membership) {
    return { 
      isValid: false, 
      error: 'Only group members can create events' 
    };
  }

  return { isValid: true };
};

/**
 * Validates that a user is the creator of an event
 */
export const validateEventCreator = async (
  eventId: string,
  userId: string,
  prisma: {
    event: {
      findUnique: (args: { where: { id: string } }) => Promise<{ creatorId: string } | null>;
    };
  }
): Promise<ValidationResult> => {
  const event = await prisma.event.findUnique({
    where: { id: eventId }
  });

  if (!event || event.creatorId !== userId) {
    return { 
      isValid: false, 
      error: 'Only the event creator can update or delete it' 
    };
  }

  return { isValid: true };
};

/**
 * Validates event status
 */
export const validateEventStatus = (status: string): ValidationResult => {
  const validStatuses = ['upcoming', 'ongoing', 'completed', 'cancelled'];
  
  if (!validStatuses.includes(status)) {
    return {
      isValid: false,
      error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
    };
  }

  return { isValid: true };
};

/**
 * Validates event capacity
 */
export const validateEventCapacity = (
  currentParticipants: number,
  maxPlayers?: number | null
): ValidationResult => {
  if (!maxPlayers) {
    return { isValid: true };
  }

  if (currentParticipants >= maxPlayers) {
    return {
      isValid: false,
      error: 'Event is at full capacity'
    };
  }

  return { isValid: true };
};

/**
 * Validates vote threshold
 */
export const validateVoteThreshold = (threshold: number | string | unknown): ValidationResult => {
  const thresholdNum = typeof threshold === 'number' ? threshold : parseFloat(String(threshold));
  
  if (isNaN(thresholdNum) || thresholdNum < 0 || thresholdNum > 1) {
    return {
      isValid: false,
      error: 'Vote threshold must be a number between 0 and 1'
    };
  }

  return { isValid: true };
};

/**
 * Validates vote deadline
 */
export const validateVoteDeadline = (
  deadline: string,
  eventStartTime: string
): ValidationResult => {
  const deadlineDate = new Date(deadline);
  const startDate = new Date(eventStartTime);
  const now = new Date();

  if (isNaN(deadlineDate.getTime())) {
    return {
      isValid: false,
      error: 'Invalid vote deadline format'
    };
  }

  if (deadlineDate <= now) {
    return {
      isValid: false,
      error: 'Vote deadline must be in the future'
    };
  }

  if (deadlineDate >= startDate) {
    return {
      isValid: false,
      error: 'Vote deadline must be before event start time'
    };
  }

  return { isValid: true };
};

