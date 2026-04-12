import { describe, it, expect, beforeEach } from 'vitest';
import { Response } from 'express';
import {
  registerSseClient,
  removeSseClient,
  pushNotificationToUser,
} from '../../services/sseService';

/** Minimal Response stub that records write() calls */
function makeMockRes(throwOnWrite = false): Response {
  const written: string[] = [];
  return {
    write: (data: string) => {
      if (throwOnWrite) throw new Error('stream closed');
      written.push(data);
      return true;
    },
    _written: written,
  } as unknown as Response;
}

describe('sseService', () => {
  // Each test uses unique userIds to avoid state bleed between tests since the
  // module keeps a module-level Map.
  let uid: string;

  beforeEach(() => {
    uid = `user-${Math.random().toString(36).slice(2)}`;
  });

  // ─── registerSseClient ─────────────────────────────────────────────────────
  describe('registerSseClient', () => {
    it('adds a client for a new user', () => {
      const res = makeMockRes();
      registerSseClient(uid, res);
      // Verify by pushing a notification and confirming write was called
      pushNotificationToUser(uid, { type: 'test' });
      expect((res as any)._written).toHaveLength(1);
    });

    it('adds multiple clients for the same user', () => {
      const res1 = makeMockRes();
      const res2 = makeMockRes();
      registerSseClient(uid, res1);
      registerSseClient(uid, res2);
      pushNotificationToUser(uid, { type: 'multi' });
      expect((res1 as any)._written).toHaveLength(1);
      expect((res2 as any)._written).toHaveLength(1);
    });
  });

  // ─── removeSseClient ───────────────────────────────────────────────────────
  describe('removeSseClient', () => {
    it('removes a specific client', () => {
      const res1 = makeMockRes();
      const res2 = makeMockRes();
      registerSseClient(uid, res1);
      registerSseClient(uid, res2);
      removeSseClient(uid, res1);
      pushNotificationToUser(uid, { type: 'after-remove' });
      expect((res1 as any)._written).toHaveLength(0); // removed
      expect((res2 as any)._written).toHaveLength(1); // still registered
    });

    it('deletes the user key when the last client is removed', () => {
      const res = makeMockRes();
      registerSseClient(uid, res);
      removeSseClient(uid, res);
      // After removal, pushing should be a no-op (no writes)
      pushNotificationToUser(uid, { type: 'ghost' });
      expect((res as any)._written).toHaveLength(0);
    });

    it('handles removal of a non-registered client gracefully', () => {
      const res = makeMockRes();
      // Never registered — should not throw
      expect(() => removeSseClient(uid, res)).not.toThrow();
    });
  });

  // ─── pushNotificationToUser ────────────────────────────────────────────────
  describe('pushNotificationToUser', () => {
    it('writes a correctly formatted SSE event string', () => {
      const res = makeMockRes();
      registerSseClient(uid, res);
      const payload = { id: 'n-1', message: 'Hello' };
      pushNotificationToUser(uid, payload);
      const written = (res as any)._written[0] as string;
      expect(written).toContain('event: notification');
      expect(written).toContain(`data: ${JSON.stringify(payload)}`);
      expect(written).toMatch(/\n\n$/);
    });

    it('is a no-op when no clients are registered', () => {
      // Should not throw even when user has no clients
      expect(() => pushNotificationToUser('unknown-user', { type: 'test' })).not.toThrow();
    });

    it('silently ignores write errors on individual streams', () => {
      const badRes = makeMockRes(true); // throws on write
      const goodRes = makeMockRes();
      registerSseClient(uid, badRes);
      registerSseClient(uid, goodRes);
      // Should not throw despite one stream throwing
      expect(() => pushNotificationToUser(uid, { type: 'test' })).not.toThrow();
      // The good client should still have received the event
      expect((goodRes as any)._written).toHaveLength(1);
    });
  });
});
