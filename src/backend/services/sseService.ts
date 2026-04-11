/**
 * Server-Sent Events (SSE) Service
 *
 * Owns the in-process SSE client registry so that any service can push
 * real-time events to connected browser/mobile clients without importing
 * from a controller.
 *
 * Controllers call registerSseClient / removeSseClient to manage the
 * lifecycle of each connection.  Services (e.g. NotificationFactory) call
 * pushNotificationToUser to fan-out an event to all active connections for
 * a given user.
 */

import { Response } from 'express';

/** userId → set of active SSE response streams */
const sseClients = new Map<string, Set<Response>>();

/**
 * Register an SSE connection for a user.
 * Called by the controller when a client opens the stream endpoint.
 */
export function registerSseClient(userId: string, res: Response): void {
  if (!sseClients.has(userId)) {
    sseClients.set(userId, new Set());
  }
  sseClients.get(userId)!.add(res);
}

/**
 * Remove an SSE connection.
 * Called by the controller when the client disconnects.
 */
export function removeSseClient(userId: string, res: Response): void {
  const clients = sseClients.get(userId);
  if (clients) {
    clients.delete(res);
    if (clients.size === 0) {
      sseClients.delete(userId);
    }
  }
}

/**
 * Push a real-time notification event to all active SSE connections for a
 * user.  Called by services after persisting a notification to the database.
 *
 * Errors on individual streams are silently ignored — a disconnected client
 * is cleaned up on the next `close` event from the controller.
 */
export function pushNotificationToUser(userId: string, payload: unknown): void {
  const clients = sseClients.get(userId);
  if (!clients || clients.size === 0) return;
  const data = JSON.stringify(payload);
  clients.forEach(res => {
    try {
      res.write(`event: notification\ndata: ${data}\n\n`);
    } catch {
      // Client may have already disconnected; cleanup happens on 'close'.
    }
  });
}
