/**
 * FixIt Now - Geocoding Service (OpenStreetMap Nominatim with Rate Limiter & Fallback)
 * Conforms to docs/SRS.md Section 4 & docs/PLAN.md Phase 3.
 *
 * Requirements:
 * - Geocodes addresses using OpenStreetMap Nominatim with a proper User-Agent.
 * - Rate limited to max ~1 request per second.
 * - Caches results by address.
 * - Fall back to area name.
 * - Fall back to simulated coordinates inside default demo zone (Indiranagar, Bengaluru).
 */

import config from '../config/index.js';

// In-memory address coordinate cache
const geocodeCache = new Map();

// Rate limiter state: Nominatim policy requires max 1 req/sec
let lastRequestTime = 0;
const RATE_LIMIT_DELAY_MS = 1050; // slightly above 1000ms for safety margin

/**
 * Demo zone bounds (Indiranagar / Central East Bengaluru)
 * Lat: 12.9716 to 12.9850, Lng: 77.6300 to 77.6500
 */
const DEMO_ZONE = {
  centerLat: 12.9784,
  centerLng: 77.6408,
  minLat: 12.9716,
  maxLat: 12.9850,
  minLng: 77.6300,
  maxLng: 77.6500,
};

/**
 * Generates deterministic coordinates inside the demo zone for an address string.
 * This guarantees the system is never blocked by external API outages or unknown addresses.
 * @param {string} address
 * @returns {{ latitude: number, longitude: number }}
 */
export function getDemoZoneFallbackCoordinates(address = '') {
  let hash = 0;
  const str = address.trim().toLowerCase();
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const positiveHash = Math.abs(hash);

  const latSpan = DEMO_ZONE.maxLat - DEMO_ZONE.minLat;
  const lngSpan = DEMO_ZONE.maxLng - DEMO_ZONE.minLng;

  const latOffset = (positiveHash % 1000) / 1000 * latSpan;
  const lngOffset = ((positiveHash >> 3) % 1000) / 1000 * lngSpan;

  const latitude = parseFloat((DEMO_ZONE.minLat + latOffset).toFixed(5));
  const longitude = parseFloat((DEMO_ZONE.minLng + lngOffset).toFixed(5));

  return { latitude, longitude };
}

/**
 * Enforces rate limiting (max 1 request per second)
 */
async function enforceRateLimit() {
  const now = Date.now();
  const timeSinceLast = now - lastRequestTime;
  if (timeSinceLast < RATE_LIMIT_DELAY_MS) {
    const waitTime = RATE_LIMIT_DELAY_MS - timeSinceLast;
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }
  lastRequestTime = Date.now();
}

/**
 * Queries OpenStreetMap Nominatim API
 * @param {string} query
 * @returns {Promise<{ latitude: number, longitude: number } | null>}
 */
async function queryNominatim(query) {
  if (!query || !query.trim()) return null;

  await enforceRateLimit();

  const userAgent =
    config.nominatimUserAgent || 'FixItNow-HomeServicesApp/1.0 (info@fixitnow.local)';

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
    query.trim()
  )}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': userAgent,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(`[Geocoding] Nominatim returned HTTP ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (Array.isArray(data) && data.length > 0 && data[0].lat && data[0].lon) {
      return {
        latitude: parseFloat(parseFloat(data[0].lat).toFixed(5)),
        longitude: parseFloat(parseFloat(data[0].lon).toFixed(5)),
      };
    }
    return null;
  } catch (err) {
    console.warn(`[Geocoding] Nominatim fetch error for "${query}": ${err.message}`);
    return null;
  }
}

/**
 * Extracts candidate area names from an address string
 * @param {string} address
 * @returns {string | null}
 */
function extractAreaName(address) {
  if (!address) return null;
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);

  // If multi-part address, the middle parts usually contain area/locality
  if (parts.length >= 2) {
    // Return area part + city e.g. "Indiranagar, Bengaluru"
    return parts.slice(Math.max(0, parts.length - 3)).join(', ');
  }

  // Check common Bengaluru localities
  const commonAreas = [
    'Indiranagar',
    'Koramangala',
    'Ulsoor',
    'HSR Layout',
    'Whitefield',
    'Jayanagar',
    'Malleshwaram',
    'BTM Layout',
    'Domlur',
    'Bengaluru',
  ];

  for (const area of commonAreas) {
    if (new RegExp(`\\b${area}\\b`, 'i').test(address)) {
      return `${area}, Bengaluru`;
    }
  }

  return null;
}

/**
 * Main geocode function.
 * Flow:
 * 1. Check in-memory cache
 * 2. Query Nominatim with full address
 * 3. Fallback: Query Nominatim with extracted area name
 * 4. Fallback: Generate demo zone simulated coordinates
 *
 * @param {string} address
 * @returns {Promise<{ latitude: number, longitude: number, source: string }>}
 */
export async function geocodeAddress(address) {
  if (!address || typeof address !== 'string' || !address.trim()) {
    const fallback = getDemoZoneFallbackCoordinates('default');
    return { ...fallback, source: 'default_zone_fallback' };
  }

  const cleanAddress = address.trim();
  const cacheKey = cleanAddress.toLowerCase();

  // 1. Check Cache
  if (geocodeCache.has(cacheKey)) {
    const cached = geocodeCache.get(cacheKey);
    return { ...cached, source: 'cache' };
  }

  // 2. Query Nominatim with Full Address
  try {
    const directResult = await queryNominatim(cleanAddress);
    if (directResult) {
      geocodeCache.set(cacheKey, directResult);
      return { ...directResult, source: 'nominatim_full' };
    }
  } catch {
    // Continue to fallback
  }

  // 3. Fallback to Area Name
  const areaName = extractAreaName(cleanAddress);
  if (areaName && areaName.toLowerCase() !== cleanAddress.toLowerCase()) {
    try {
      const areaResult = await queryNominatim(areaName);
      if (areaResult) {
        geocodeCache.set(cacheKey, areaResult);
        return { ...areaResult, source: 'nominatim_area' };
      }
    } catch {
      // Continue to demo zone fallback
    }
  }

  // 4. Fallback to Demo Zone Simulated Coordinates
  const fallbackResult = getDemoZoneFallbackCoordinates(cleanAddress);
  geocodeCache.set(cacheKey, fallbackResult);
  console.log(`[Geocoding Fallback] Simulated coords for "${cleanAddress}":`, fallbackResult);
  return { ...fallbackResult, source: 'demo_zone_simulated' };
}

export default {
  geocodeAddress,
  getDemoZoneFallbackCoordinates,
};
