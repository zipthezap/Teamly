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
  prisma: any
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
  prisma: any
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
