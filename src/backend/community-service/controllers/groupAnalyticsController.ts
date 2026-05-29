import { Request, Response } from 'express';

import { InviteService } from '../../services/inviteService';
import { logger } from '../../utils/logger';
import { ForbiddenError, BadRequestError } from '../../utils/errors';
import * as permissionService from '../../services/permissionService';
import { Permission } from '../../../shared/types/permissions.types';

export const getInviteAnalytics = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { from, to } = req.query;

  const hasPermission = await permissionService.hasGroupPermission(
    req.user!.id,
    id,
    Permission.GROUP_VIEW_INVITE_ANALYTICS
  );

  if (!hasPermission) {
    throw new ForbiddenError('You do not have permission to view invite analytics');
  }

  let fromDate: Date | undefined;
  let toDate: Date | undefined;

  if (from) {
    fromDate = new Date(from as string);
    if (Number.isNaN(fromDate.getTime())) throw new BadRequestError('Invalid from date');
  }
  if (to) {
    toDate = new Date(to as string);
    if (Number.isNaN(toDate.getTime())) throw new BadRequestError('Invalid to date');
  }

  try {
    const analytics = await InviteService.getInviteAnalytics('group', id, { from: fromDate, to: toDate });
    res.json({ analytics });
  } catch (error) {
    logger.error('Failed to get group invite analytics', 'CommunityService', { error, groupId: id });
    res.status(500).json({ error: 'Failed to get invite analytics' });
  }
};