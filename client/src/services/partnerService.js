/**
 * FixIt Now - Partner Service (Sample Data)
 * Returns eligible nearby partners for dispatch and matching.
 * Conforms to SRS FR-M3 and FR-C10.
 */

import { mockPartners } from '../mockData';

/**
 * Get nearest eligible partner offering a specific trade within 2 km
 */
export async function getEligiblePartnerForTrade(serviceId) {
  await new Promise((resolve) => setTimeout(resolve, 200));

  const numServiceId = Number(serviceId);
  const found = mockPartners.find(
    (p) => p.service_id === numServiceId && p.online && p.kyc_status === 'verified'
  );

  if (found) {
    return {
      ...found,
      distance_km: 0.8,
      estimated_arrival_minutes: 14,
    };
  }

  // Fallback to first verified partner for demo flexibility
  const fallback = mockPartners[0];
  return {
    ...fallback,
    distance_km: 1.1,
    estimated_arrival_minutes: 16,
  };
}

/**
 * Get partner details by ID
 */
export async function getPartnerById(partnerId) {
  await new Promise((resolve) => setTimeout(resolve, 100));
  const found = mockPartners.find((p) => p.id === Number(partnerId));
  return found || mockPartners[0];
}
