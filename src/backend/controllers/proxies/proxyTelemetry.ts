// Use dynamic require when recording telemetry so unit tests that partially
// mock `services/metricsService` don't fail during module import.
const safeRecordServiceProxyOutcome = (proxy: string, service: string, outcome: string, reason: string) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const metrics = require('../../services/metricsService');
    if (metrics && typeof metrics.recordServiceProxyOutcome === 'function') {
      metrics.recordServiceProxyOutcome(proxy, service, outcome, reason);
    }
  } catch {
    // swallow — telemetry is best-effort for tests
  }
};

export type ProxyFallbackReason =
  | 'service_url_missing'
  | 'timeout'
  | 'network'
  | 'upstream_error'
  | 'remote_html_error'
  | 'passthrough_error'
  | 'unknown';

export const getProxyFallbackReason = (error: unknown): ProxyFallbackReason => {
  if (error instanceof Error && error.name === 'AbortError') {
    return 'timeout';
  }
  if (error instanceof Error) {
    return 'network';
  }
  return 'unknown';
};

export const recordProxyRemoteSuccess = (proxy: string, service: string): void => {
  safeRecordServiceProxyOutcome(proxy, service, 'remote_success', 'none');
};

export const recordProxyFallback = (
  proxy: string,
  service: string,
  reason: ProxyFallbackReason,
): void => {
  safeRecordServiceProxyOutcome(proxy, service, 'fallback', reason);
};

export const recordProxyFailClosed = (
  proxy: string,
  service: string,
  reason: ProxyFallbackReason,
): void => {
  safeRecordServiceProxyOutcome(proxy, service, 'fail_closed', reason);
};