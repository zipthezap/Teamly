const stableSerialize = (value: unknown): string => {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => `${JSON.stringify(key)}:${stableSerialize(val)}`);

  return `{${entries.join(',')}}`;
};

const hashBucket = (value: string): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash % 100);
};

export const buildSessionIdempotencyKey = (input: {
  sessionId: string;
  type: string;
  userIds: string[];
  params?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}): string => {
  const sortedUserIds = [...input.userIds].sort();
  const payload = [
    input.sessionId,
    input.type,
    stableSerialize(sortedUserIds),
    stableSerialize(input.params || {}),
    stableSerialize(input.metadata || {}),
  ].join('|');
  return `sn_${hashBucket(payload)}_${payload.length}`;
};

export const buildGroupIdempotencyKey = (input: {
  groupId: string;
  type: string;
  userIds: string[];
  params?: Record<string, unknown>;
}): string => {
  const sortedUserIds = [...input.userIds].sort();
  const payload = [
    input.groupId,
    input.type,
    stableSerialize(sortedUserIds),
    stableSerialize(input.params || {}),
  ].join('|');
  return `gn_${hashBucket(payload)}_${payload.length}`;
};

export const buildTeamUpIdempotencyKey = (input: {
  teamUpRequestId: string;
  type: string;
  userIds: string[];
  params?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}): string => {
  const sortedUserIds = [...input.userIds].sort();
  const payload = [
    input.teamUpRequestId,
    input.type,
    stableSerialize(sortedUserIds),
    stableSerialize(input.params || {}),
    stableSerialize(input.metadata || {}),
  ].join('|');
  return `tun_${hashBucket(payload)}_${payload.length}`;
};
