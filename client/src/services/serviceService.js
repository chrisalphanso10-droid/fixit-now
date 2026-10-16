/**
 * Service Category Data Service
 * Loads trade services from backend API with fallback.
 * Conforms to docs/PLAN.md and docs/SRS.md.
 */
import { get } from './api.js';
import { mockServices, mockFaqs } from '../mockData/index.js';

/**
 * Fetch all active services
 * @returns {Promise<Array<{ id: number, name: string, slug: string, description: string, active: boolean }>>}
 */
export async function getServices() {
  try {
    const res = await get('/api/services');
    if (res && res.data && Array.isArray(res.data) && res.data.length > 0) {
      return res.data;
    }
  } catch (err) {
    console.warn('[Services Fetch Fallback]:', err.message);
  }
  return mockServices.filter((s) => s.active);
}

/**
 * Fetch FAQ items for the landing page
 * @returns {Promise<Array<{ id: number, question: string, answer: string }>>}
 */
export async function getLandingFaqs() {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(mockFaqs);
    }, 50);
  });
}

export default {
  getServices,
  getLandingFaqs,
};
