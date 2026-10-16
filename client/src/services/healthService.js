import { get } from './api';

/**
 * Service to fetch server health check
 * @returns {Promise<{ status: string, service: string, timestamp: string, uptime: number }>}
 */
export async function checkServerHealth() {
  return get('/api/health');
}
