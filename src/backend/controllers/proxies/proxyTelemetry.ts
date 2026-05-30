import { recordServiceProxyOutcome } from '../../services/metricsService';

export type ProxyFallbackReason =
  | 'service_url_missing'
  | 'timeout'
  | 'network'
  | 'upstream_error'
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
  recordServiceProxyOutcome(proxy, service, 'remote_success', 'none');
};

export const recordProxyFallback = (
  proxy: string,
  service: string,
  reason: ProxyFallbackReason,
): void => {
  recordServiceProxyOutcome(proxy, service, 'fallback', reason);
};

export const recordProxyFailClosed = (
  proxy: string,
  service: string,
  reason: ProxyFallbackReason,
): void => {
  recordServiceProxyOutcome(proxy, service, 'fail_closed', reason);
};