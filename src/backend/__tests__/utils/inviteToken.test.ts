import { describe, it, expect } from 'vitest';
import { createInviteToken } from '../../utils/inviteToken';

describe('createInviteToken', () => {
  it('returns a string of length 64', () => {
    const token = createInviteToken();
    expect(typeof token).toBe('string');
    expect(token).toHaveLength(64);
  });

  it('matches lowercase hex pattern', () => {
    const token = createInviteToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces unique tokens across 100 consecutive calls', () => {
    const tokens = new Set(Array.from({ length: 100 }, () => createInviteToken()));
    expect(tokens.size).toBe(100);
  });
});
