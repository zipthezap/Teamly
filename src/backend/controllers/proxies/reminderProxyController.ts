import { Request, Response } from 'express';

import {
  deleteReminder as deleteReminderLegacy,
  getUserReminders as getUserRemindersLegacy,
  updateReminder as updateReminderLegacy,
} from '../reminderController';
import { proxyJsonServiceRequest } from './serviceProxy';

const COMMUNITY_SERVICE_URL = process.env.COMMUNITY_SERVICE_URL;

export const getUserReminders = async (req: Request, res: Response) =>
  proxyJsonServiceRequest(req, res, COMMUNITY_SERVICE_URL, '/api/reminders', getUserRemindersLegacy, 'community-service', {
    failClosed: true,
    failClosedMessage: 'Reminder routes are unavailable without community-service',
    proxyName: 'ReminderProxyController',
  });

export const updateReminder = async (req: Request, res: Response) =>
  proxyJsonServiceRequest(
    req,
    res,
    COMMUNITY_SERVICE_URL,
    `/api/reminders/${req.params.reminderId}`,
    updateReminderLegacy,
    'community-service',
    {
      failClosed: true,
      failClosedMessage: 'Reminder routes are unavailable without community-service',
      proxyName: 'ReminderProxyController',
    }
  );

export const deleteReminder = async (req: Request, res: Response) =>
  proxyJsonServiceRequest(
    req,
    res,
    COMMUNITY_SERVICE_URL,
    `/api/reminders/${req.params.reminderId}`,
    deleteReminderLegacy,
    'community-service',
    {
      failClosed: true,
      failClosedMessage: 'Reminder routes are unavailable without community-service',
      proxyName: 'ReminderProxyController',
    }
  );