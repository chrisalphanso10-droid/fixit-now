/**
 * FixIt Now - Unit Tests for Haversine Distance & Partner Eligibility Filter
 * Conforms to docs/PLAN.md Phase 6 and docs/SRS.md FR-M1 to FR-M6.
 *
 * Can be run via: node server/test/matching.test.js
 */

import assert from 'node:assert/strict';
import {
  calculateHaversineDistance,
  isPartnerEligible,
  filterEligiblePartners,
} from '../src/services/matching.service.js';

let passed = 0;
let failed = 0;

function runTest(testName, fn) {
  try {
    fn();
    console.log(`  ✓ ${testName}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${testName}`);
    console.error(`    Error: ${err.message}`);
    failed++;
  }
}

console.log('====================================================');
console.log('FixIt Now: Unit Tests - Matching & Distance Formula');
console.log('====================================================\n');

// =============================================================================
// 1. HAVERSINE DISTANCE FORMULA TESTS
// =============================================================================
console.log('Suite 1: Haversine Distance Calculations');

runTest('Should return 0 for identical points', () => {
  const d = calculateHaversineDistance(12.9784, 77.6408, 12.9784, 77.6408);
  assert.equal(d, 0);
});

runTest('Should calculate symmetry: dist(A, B) === dist(B, A)', () => {
  const d1 = calculateHaversineDistance(12.9740, 77.6350, 12.9810, 77.6450);
  const d2 = calculateHaversineDistance(12.9810, 77.6450, 12.9740, 77.6350);
  assert.equal(d1, d2);
});

runTest('Should correctly measure nearby distance in Bengaluru (< 2.0 km)', () => {
  // Indiranagar 12th Main (12.9740, 77.6350) to Defence Colony (12.9810, 77.6450)
  const d = calculateHaversineDistance(12.9740, 77.6350, 12.9810, 77.6450);
  assert.ok(d > 1.2 && d < 1.5, `Distance was ${d} km, expected ~1.33 km`);
  assert.ok(d <= 2.0, 'Must be within 2.0 km');
});

runTest('Should correctly measure medium distance outside 2.0 km', () => {
  // Indiranagar (12.9740, 77.6350) to Koramangala (12.9352, 77.6245) ~ 4.5 km
  const d = calculateHaversineDistance(12.9740, 77.6350, 12.9352, 77.6245);
  assert.ok(d > 4.0 && d < 5.0, `Distance was ${d} km, expected ~4.5 km`);
  assert.ok(d > 2.0, 'Must exceed 2.0 km');
});

runTest('Should correctly measure far distance (> 10 km)', () => {
  // Indiranagar (12.9740, 77.6350) to Whitefield (12.9698, 77.7499) ~ 12.5 km
  const d = calculateHaversineDistance(12.9740, 77.6350, 12.9698, 77.7499);
  assert.ok(d > 12.0 && d < 13.0, `Distance was ${d} km, expected ~12.5 km`);
  assert.ok(d > 2.0, 'Must exceed 2.0 km');
});

runTest('Should throw descriptive error for NaN or non-numeric inputs', () => {
  assert.throws(() => calculateHaversineDistance('invalid', 77.6, 12.9, 77.6), {
    message: /Coordinates must be valid numeric values/,
  });
});

// =============================================================================
// 2. PARTNER ELIGIBILITY FILTER TESTS
// =============================================================================
console.log('\nSuite 2: Partner Eligibility Filter (6 Rules)');

const customerCoords = { latitude: 12.9784, longitude: 77.6408 };
const requestedServiceId = 2; // Plumber
const referenceNow = new Date('2026-10-17T12:00:00Z');

function createSamplePartner(overrides = {}) {
  return {
    id: 'partner-001',
    name: 'Rajesh Kumar',
    service_id: 2, // Plumber
    online: true,
    kyc_status: 'verified',
    subscription_status: 'active',
    subscription_end_date: '2026-12-31T23:59:59Z',
    has_active_job: false,
    active_jobs_count: 0,
    latitude: 12.9750, // ~0.5 km away from customer
    longitude: 77.6420,
    ...overrides,
  };
}

runTest('Rule 1-6: Full match partner is eligible and included', () => {
  const partner = createSamplePartner();
  const eligible = isPartnerEligible(partner, requestedServiceId, customerCoords, 2.0, referenceNow);
  assert.equal(eligible, true);
});

runTest('Rule 1: Offline partner is ineligible', () => {
  const partner = createSamplePartner({ online: false });
  assert.equal(isPartnerEligible(partner, requestedServiceId, customerCoords, 2.0, referenceNow), false);
});

runTest('Rule 2: KYC pending partner is ineligible', () => {
  const partner = createSamplePartner({ kyc_status: 'pending' });
  assert.equal(isPartnerEligible(partner, requestedServiceId, customerCoords, 2.0, referenceNow), false);
});

runTest('Rule 2: KYC rejected partner is ineligible', () => {
  const partner = createSamplePartner({ kyc_status: 'rejected' });
  assert.equal(isPartnerEligible(partner, requestedServiceId, customerCoords, 2.0, referenceNow), false);
});

runTest('Rule 3: Expired subscription partner is ineligible', () => {
  const partner = createSamplePartner({
    subscription_end_date: '2026-09-01T00:00:00Z', // In the past relative to referenceNow
  });
  assert.equal(isPartnerEligible(partner, requestedServiceId, customerCoords, 2.0, referenceNow), false);
});

runTest('Rule 3: Non-active subscription status is ineligible', () => {
  const partner = createSamplePartner({ subscription_status: 'expired' });
  assert.equal(isPartnerEligible(partner, requestedServiceId, customerCoords, 2.0, referenceNow), false);
});

runTest('Rule 3: Missing subscription is ineligible', () => {
  const partner = createSamplePartner({
    subscription_status: null,
    subscription_end_date: null,
    subscription: null,
  });
  assert.equal(isPartnerEligible(partner, requestedServiceId, customerCoords, 2.0, referenceNow), false);
});

runTest('Rule 4: Wrong service category partner is ineligible', () => {
  const partner = createSamplePartner({ service_id: 1 }); // Electrician instead of Plumber (2)
  assert.equal(isPartnerEligible(partner, requestedServiceId, customerCoords, 2.0, referenceNow), false);
});

runTest('Rule 5: Partner currently on an active job is ineligible', () => {
  const p1 = createSamplePartner({ has_active_job: true });
  assert.equal(isPartnerEligible(p1, requestedServiceId, customerCoords, 2.0, referenceNow), false);

  const p2 = createSamplePartner({ active_jobs_count: 1 });
  assert.equal(isPartnerEligible(p2, requestedServiceId, customerCoords, 2.0, referenceNow), false);
});

runTest('Rule 6: Partner located more than 2 km away is ineligible (Busy case)', () => {
  // Whitefield (~12 km away)
  const partner = createSamplePartner({
    latitude: 12.9698,
    longitude: 77.7499,
  });
  assert.equal(isPartnerEligible(partner, requestedServiceId, customerCoords, 2.0, referenceNow), false);
});

runTest('Rule 6: Partner located at 1.8 km (< 2.0 km) is eligible', () => {
  // Defence Colony Indiranagar (~1.3 km away)
  const partner = createSamplePartner({
    latitude: 12.9810,
    longitude: 77.6450,
  });
  assert.equal(isPartnerEligible(partner, requestedServiceId, customerCoords, 2.0, referenceNow), true);
});

// =============================================================================
// 3. SORTING AND BATCH FILTERING TESTS
// =============================================================================
console.log('\nSuite 3: Batch Filter & Nearest-First Sorting');

runTest('filterEligiblePartners should sort nearest partners first', () => {
  const pFar = createSamplePartner({
    id: 'p-far',
    name: 'Far Partner (1.6 km)',
    latitude: 12.9880,
    longitude: 77.6510,
  });
  const pClose = createSamplePartner({
    id: 'p-close',
    name: 'Close Partner (0.3 km)',
    latitude: 12.9770,
    longitude: 77.6420,
  });
  const pMid = createSamplePartner({
    id: 'p-mid',
    name: 'Mid Partner (0.9 km)',
    latitude: 12.9820,
    longitude: 77.6460,
  });
  const pExcluded = createSamplePartner({
    id: 'p-offline',
    name: 'Offline Partner',
    online: false,
    latitude: 12.9770,
    longitude: 77.6420,
  });

  const list = [pFar, pExcluded, pClose, pMid];
  const results = filterEligiblePartners(list, requestedServiceId, customerCoords, 2.0, referenceNow);

  assert.equal(results.length, 3, 'Exactly 3 eligible partners should be returned');
  assert.equal(results[0].id, 'p-close', 'Nearest partner must be first');
  assert.equal(results[1].id, 'p-mid', 'Middle partner must be second');
  assert.equal(results[2].id, 'p-far', 'Furthest eligible partner must be last');
  assert.ok(results[0].distance_km < results[1].distance_km);
  assert.ok(results[1].distance_km < results[2].distance_km);
});

runTest('filterEligiblePartners returns empty array when all partners are outside 2 km', () => {
  const p1 = createSamplePartner({ latitude: 12.9352, longitude: 77.6245 }); // Koramangala (~5 km)
  const p2 = createSamplePartner({ latitude: 12.9698, longitude: 77.7499 }); // Whitefield (~12 km)

  const results = filterEligiblePartners([p1, p2], requestedServiceId, customerCoords, 2.0, referenceNow);
  assert.equal(results.length, 0, 'No partners should qualify');
});

console.log('\n----------------------------------------------------');
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('----------------------------------------------------');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
