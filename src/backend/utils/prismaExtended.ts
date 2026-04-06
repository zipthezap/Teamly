/**
 * Typed accessors for models added in migration 20260406000000.
 *
 * These helpers exist because `prisma generate` must be re-run after applying
 * the migration that adds GroupBan and AuditLog.  Until then the generated
 * PrismaClient types don't include those models and we need an escape hatch.
 *
 * Usage:
 *   import { groupBan, auditLog, txGroupBan, txAuditLog } from '../utils/prismaExtended';
 *   await groupBan(prisma).findUnique({ where: { groupId_userId: { ... } } });
 *   await txAuditLog(tx).create({ data: { ... } });
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

export function groupBan(client: AnyClient) {
  return (client as AnyClient).groupBan;
}

export function auditLog(client: AnyClient) {
  return (client as AnyClient).auditLog;
}

// Convenience aliases for transaction clients
export const txGroupBan = groupBan;
export const txAuditLog = auditLog;
