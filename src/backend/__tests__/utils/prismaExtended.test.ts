import { describe, it, expect } from 'vitest';
import { groupBan, auditLog, txGroupBan, txAuditLog } from '../../utils/prismaExtended';

function makeMockClient() {
  return {
    groupBan: { findUnique: () => null, create: () => null },
    auditLog: { create: () => null, findMany: () => [] },
  };
}

describe('groupBan', () => {
  it('returns client.groupBan (same reference)', () => {
    const client = makeMockClient();
    expect(groupBan(client)).toBe(client.groupBan);
  });
});

describe('auditLog', () => {
  it('returns client.auditLog (same reference)', () => {
    const client = makeMockClient();
    expect(auditLog(client)).toBe(client.auditLog);
  });
});

describe('txGroupBan / txAuditLog aliases', () => {
  it('txGroupBan is the same function as groupBan', () => {
    expect(txGroupBan).toBe(groupBan);
  });

  it('txAuditLog is the same function as auditLog', () => {
    expect(txAuditLog).toBe(auditLog);
  });

  it('txGroupBan returns client.groupBan', () => {
    const client = makeMockClient();
    expect(txGroupBan(client)).toBe(client.groupBan);
  });

  it('txAuditLog returns client.auditLog', () => {
    const client = makeMockClient();
    expect(txAuditLog(client)).toBe(client.auditLog);
  });
});
