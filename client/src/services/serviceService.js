/**
 * Service Category Data Service
 * Loads trade services from mock data (or backend API once Phase 1/5 is completed).
 */
import { mockServices, mockFaqs } from '../mockData/index.js';

/**
 * Fetch all active services
 * @returns {Promise<Array<{ id: number, name: string, slug: string, description: string, base_price_estimate: number, active: boolean }>>}
 */
export async function getServices() {
  // Simulate network dispatch with sample data per PLAN.md
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(mockServices.filter((s) => s.active));
    }, 50);
  });
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
