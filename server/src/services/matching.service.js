/**
 * FixIt Now - Partner Matching Service
 * Conforms to docs/SRS.md FR-C10, FR-M1 to FR-M6 and docs/PLAN.md Phase 6.
 *
 * Matching Rules:
 * A partner is eligible if and only if:
 * 1. online === true (dispatch radar active)
 * 2. kyc_status === 'verified' (identity and certifications approved by admin)
 * 3. active subscription (holding a paid, unexpired plan)
 * 4. offers the requested service category
 * 5. not currently on an active job (status IN ('accepted', 'partner_on_way', 'partner_arrived', 'service_started'))
 * 6. within 2 km of the request coordinates (computed via Haversine formula)
 *
 * Results are sorted nearest first.
 */

import db from '../config/db.js';

const EARTH_RADIUS_KM = 6371;

/**
 * Calculates great-circle distance between two geographic coordinates
 * using the Haversine formula (Earth radius = 6371 km).
 *
 * @param {number|string} lat1 Latitude of point 1 (degrees)
 * @param {number|string} lon1 Longitude of point 1 (degrees)
 * @param {number|string} lat2 Latitude of point 2 (degrees)
 * @param {number|string} lon2 Longitude of point 2 (degrees)
 * @returns {number} Distance in kilometers
 */
export function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const p1Lat = Number(lat1);
  const p1Lon = Number(lon1);
  const p2Lat = Number(lat2);
  const p2Lon = Number(lon2);

  if (
    Number.isNaN(p1Lat) ||
    Number.isNaN(p1Lon) ||
    Number.isNaN(p2Lat) ||
    Number.isNaN(p2Lon)
  ) {
    throw new Error('Coordinates must be valid numeric values.');
  }

  // Exact point identity optimization
  if (p1Lat === p2Lat && p1Lon === p2Lon) {
    return 0;
  }

  const toRad = (degrees) => (degrees * Math.PI) / 180;

  const dLat = toRad(p2Lat - p1Lat);
  const dLon = toRad(p2Lon - p1Lon);
  const phi1 = toRad(p1Lat);
  const phi2 = toRad(p2Lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = EARTH_RADIUS_KM * c;

  return parseFloat(distance.toFixed(4));
}

/**
 * Validates individual partner eligibility against request criteria.
 *
 * @param {object} partner Partner object
 * @param {number|string} requestedServiceId Required service category ID
 * @param {{ latitude: number, longitude: number }} requestCoords Customer request coordinates
 * @param {number} [maxDistanceKm=2.0] Maximum radius in kilometers (default 2.0 km per SRS FR-M3)
 * @param {Date} [now=new Date()] Reference timestamp for subscription validity
 * @returns {boolean} True if partner satisfies all 6 eligibility requirements
 */
export function isPartnerEligible(
  partner,
  requestedServiceId,
  requestCoords,
  maxDistanceKm = 2.0,
  now = new Date()
) {
  if (!partner) return false;

  // 1. Online status check
  if (partner.online !== true) {
    return false;
  }

  // 2. KYC verification check
  if (partner.kyc_status !== 'verified') {
    return false;
  }

  // 3. Service category match (Each partner offers exactly one service)
  if (Number(partner.service_id) !== Number(requestedServiceId)) {
    return false;
  }

  // 4. Active, unexpired subscription check
  let hasValidSubscription = false;
  if (partner.subscription_status === 'active') {
    if (!partner.subscription_end_date) {
      hasValidSubscription = true;
    } else {
      hasValidSubscription = new Date(partner.subscription_end_date) > now;
    }
  } else if (partner.subscription) {
    if (partner.subscription.status === 'active') {
      if (!partner.subscription.end_date) {
        hasValidSubscription = true;
      } else {
        hasValidSubscription = new Date(partner.subscription.end_date) > now;
      }
    }
  } else if (partner.has_active_subscription === true) {
    hasValidSubscription = true;
  }

  if (!hasValidSubscription) {
    return false;
  }

  // 5. Not on another active job check
  if (partner.has_active_job === true) {
    return false;
  }
  if (partner.active_jobs_count != null && Number(partner.active_jobs_count) > 0) {
    return false;
  }

  // 6. Distance check (Haversine <= 2.0 km)
  const pLat =
    partner.latitude ??
    partner.lat ??
    partner.coordinates?.lat ??
    partner.coordinates?.latitude;
  const pLon =
    partner.longitude ??
    partner.lng ??
    partner.coordinates?.lng ??
    partner.coordinates?.longitude;

  const rLat = requestCoords?.latitude ?? requestCoords?.lat;
  const rLon = requestCoords?.longitude ?? requestCoords?.lng;

  if (pLat == null || pLon == null || rLat == null || rLon == null) {
    return false;
  }

  const distance = calculateHaversineDistance(pLat, pLon, rLat, rLon);
  if (distance > maxDistanceKm) {
    return false;
  }

  return true;
}

/**
 * Filters an array of partners to keep only those eligible for the request,
 * computes distance and estimated arrival time, and sorts nearest first.
 *
 * @param {Array<object>} partners List of partner candidates
 * @param {number|string} requestedServiceId Required service ID
 * @param {{ latitude: number, longitude: number }} requestCoords Customer location
 * @param {number} [maxDistanceKm=2.0] Maximum dispatch radius
 * @param {Date} [now=new Date()] Current reference time
 * @returns {Array<object>} Filtered and sorted eligible partners (nearest first)
 */
export function filterEligiblePartners(
  partners,
  requestedServiceId,
  requestCoords,
  maxDistanceKm = 2.0,
  now = new Date()
) {
  if (!Array.isArray(partners)) return [];

  const rLat = requestCoords?.latitude ?? requestCoords?.lat;
  const rLon = requestCoords?.longitude ?? requestCoords?.lng;

  const eligible = [];

  for (const partner of partners) {
    if (isPartnerEligible(partner, requestedServiceId, requestCoords, maxDistanceKm, now)) {
      const pLat =
        partner.latitude ??
        partner.lat ??
        partner.coordinates?.lat ??
        partner.coordinates?.latitude;
      const pLon =
        partner.longitude ??
        partner.lng ??
        partner.coordinates?.lng ??
        partner.coordinates?.longitude;

      const dist = calculateHaversineDistance(pLat, pLon, rLat, rLon);
      const roundedDistance = parseFloat(dist.toFixed(2));
      const etaMinutes = Math.max(5, Math.round(roundedDistance * 6 + 5));

      eligible.push({
        ...partner,
        distance_km: roundedDistance,
        eta_minutes: etaMinutes,
      });
    }
  }

  // Sort nearest first (ascending by distance)
  eligible.sort((a, b) => a.distance_km - b.distance_km);

  return eligible;
}

/**
 * Queries PostgreSQL database for candidate partners matching the requested service,
 * checks live online state, KYC, active subscription, active job exclusion,
 * and filters by the 2 km radius.
 *
 * @param {number|string} serviceId
 * @param {number} customerLat
 * @param {number} customerLon
 * @param {number} [maxDistanceKm=2.0]
 * @returns {Promise<Array<object>>} Eligible partners sorted nearest first
 */
export async function findEligiblePartnersFromDb(
  serviceId,
  customerLat,
  customerLon,
  maxDistanceKm = 2.0
) {
  const result = await db.query(
    `SELECT
       p.id,
       p.name,
       p.email,
       p.phone,
       p.address,
       p.service_id,
       s.name AS service_name,
       p.online,
       p.latitude,
       p.longitude,
       p.kyc_status,
       p.rating,
       p.total_jobs,
       p.photo_url,
       p.badge,
       p.vehicle,
       sub.id AS subscription_id,
       sub.status AS subscription_status,
       sub.end_date AS subscription_end_date,
       (
         SELECT COUNT(*)
         FROM requests r
         WHERE r.partner_id = p.id
           AND r.status IN ('accepted', 'partner_on_way', 'partner_arrived', 'service_started')
       ) AS active_jobs_count
     FROM partners p
     JOIN services s ON p.service_id = s.id
     LEFT JOIN LATERAL (
       SELECT id, status, end_date
       FROM subscriptions
       WHERE partner_id = p.id AND status = 'active' AND end_date > CURRENT_TIMESTAMP
       ORDER BY end_date DESC
       LIMIT 1
     ) sub ON true
     WHERE p.online = true
       AND p.kyc_status = 'verified'
       AND p.service_id = $1
       AND sub.id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM requests r
         WHERE r.partner_id = p.id
           AND r.status IN ('accepted', 'partner_on_way', 'partner_arrived', 'service_started')
       )`,
    [serviceId]
  );

  return filterEligiblePartners(
    result.rows,
    serviceId,
    { latitude: customerLat, longitude: customerLon },
    maxDistanceKm
  );
}

export default {
  calculateHaversineDistance,
  isPartnerEligible,
  filterEligiblePartners,
  findEligiblePartnersFromDb,
};
