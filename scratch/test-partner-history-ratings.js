/**
 * Scratch test for partner recent jobs and ratings reflection
 */
import {
  savePartnerRecentJob,
  addPartnerRating,
  getPartnerHistory,
  getPartnerRatings,
} from '../client/src/services/partnerService.js';
import {
  submitRequestRating,
  cancelServiceRequest,
} from '../client/src/services/requestService.js';

// Setup Mock LocalStorage for node environment
const storage = {};
global.localStorage = {
  getItem: (key) => storage[key] || null,
  setItem: (key, val) => { storage[key] = String(val); },
  removeItem: (key) => { delete storage[key]; },
  clear: () => { Object.keys(storage).forEach((k) => delete storage[k]); },
};

global.window = {
  dispatchEvent: (event) => {},
  addEventListener: () => {},
  removeEventListener: () => {},
};

async function runTests() {
  console.log('--- Starting Partner History & Ratings Tests ---');

  // Test 1: Baseline history
  const baseHistory = await getPartnerHistory(101, 'ALL');
  console.log(`Baseline history entries count: ${baseHistory.length}`);
  console.assert(baseHistory.length >= 4, 'Should have baseline entries');

  // Test 2: Save recently completed job
  const completedJob = {
    id: 'req-test-completed-1',
    order_number: 'ORD-CMP1',
    customer_name: 'Mohit Kumar',
    customer_phone: '+91 98765 11111',
    service_name: 'Electrical Repairs',
    problem: 'Short circuit in breaker box',
    address: 'Indiranagar 100ft road',
    status: 'completed',
    amount: 550.0,
    payment_mode: 'Direct UPI (On-site)',
  };
  savePartnerRecentJob(completedJob);

  const historyAfterComplete = await getPartnerHistory(101, 'ALL');
  console.assert(
    historyAfterComplete[0].order_number === 'ORD-CMP1',
    `Top history entry should be ORD-CMP1, got ${historyAfterComplete[0]?.order_number}`
  );
  console.assert(
    historyAfterComplete[0].status === 'completed',
    `Top history status should be completed, got ${historyAfterComplete[0]?.status}`
  );
  console.log('✓ Completed job successfully appears at top of history');

  // Test 3: Save recently cancelled job
  const cancelledJob = {
    id: 'req-test-cancelled-2',
    order_number: 'ORD-CAN2',
    customer_name: 'Priya Verma',
    customer_phone: '+91 98765 22222',
    service_name: 'Plumbing Repairs',
    problem: 'Tap leaking heavily',
    address: 'Koramangala 4th Block',
    status: 'cancelled',
    cancel_reason: 'Customer cancelled due to emergency',
  };
  savePartnerRecentJob(cancelledJob);

  const historyAfterCancel = await getPartnerHistory(101, 'ALL');
  console.assert(
    historyAfterCancel[0].order_number === 'ORD-CAN2',
    `Top history entry should be ORD-CAN2, got ${historyAfterCancel[0]?.order_number}`
  );
  console.assert(
    historyAfterCancel[0].status === 'cancelled',
    `Top history status should be cancelled, got ${historyAfterCancel[0]?.status}`
  );
  console.assert(
    historyAfterCancel[0].cancel_reason === 'Customer cancelled due to emergency',
    'Cancel reason should be preserved'
  );
  console.log('✓ Cancelled job successfully appears at top of history');

  // Test 4: Filter by COMPLETED and CANCELLED
  const completedOnly = await getPartnerHistory(101, 'COMPLETED');
  console.assert(
    completedOnly.every((j) => j.status === 'completed'),
    'All entries in COMPLETED filter must be completed'
  );
  console.assert(
    completedOnly.some((j) => j.order_number === 'ORD-CMP1'),
    'Completed filter must contain ORD-CMP1'
  );
  console.assert(
    !completedOnly.some((j) => j.order_number === 'ORD-CAN2'),
    'Completed filter must NOT contain ORD-CAN2'
  );
  console.log('✓ Filter by COMPLETED works correctly');

  const cancelledOnly = await getPartnerHistory(101, 'CANCELLED');
  console.assert(
    cancelledOnly.every((j) => j.status === 'cancelled'),
    'All entries in CANCELLED filter must be cancelled'
  );
  console.assert(
    cancelledOnly.some((j) => j.order_number === 'ORD-CAN2'),
    'Cancelled filter must contain ORD-CAN2'
  );
  console.assert(
    !cancelledOnly.some((j) => j.order_number === 'ORD-CMP1'),
    'Cancelled filter must NOT contain ORD-CMP1'
  );
  console.log('✓ Filter by CANCELLED works correctly');

  // Test 5: Customer submits rating for ORD-CMP1
  await submitRequestRating('req-test-completed-1', {
    stars: 5,
    comment: 'Super fast arrival! Fixed the circuit in 15 minutes. Very polite.',
    requestData: {
      id: 'req-test-completed-1',
      order_number: 'ORD-CMP1',
      customer_name: 'Mohit Kumar',
      service_name: 'Electrical Repairs',
    },
  });

  // Verify history reflects rating
  const historyAfterRating = await getPartnerHistory(101, 'ALL');
  const ratedJob = historyAfterRating.find((j) => j.order_number === 'ORD-CMP1');
  console.assert(ratedJob && ratedJob.rating, 'Job in history should have rating attached');
  console.assert(ratedJob.rating.stars === 5, 'Rating stars should be 5');
  console.assert(
    ratedJob.rating.comment.includes('Super fast arrival'),
    'Rating comment should match'
  );
  console.log('✓ Rating and comment reflected in Partner Job History entry');

  // Test 6: Verify Partner Ratings View data
  const ratings = await getPartnerRatings(101);
  console.assert(
    ratings.recent_reviews && ratings.recent_reviews.length > 0,
    'Ratings should have recent_reviews'
  );
  const topReview = ratings.recent_reviews[0];
  console.assert(
    topReview.order_number === 'ORD-CMP1',
    `Top review order_number should be ORD-CMP1, got ${topReview.order_number}`
  );
  console.assert(
    topReview.customer_name === 'Mohit Kumar',
    `Top review customer_name should be Mohit Kumar, got ${topReview.customer_name}`
  );
  console.assert(
    topReview.stars === 5,
    `Top review stars should be 5, got ${topReview.stars}`
  );
  console.assert(
    topReview.comment.includes('Super fast arrival'),
    `Top review comment should match customer feedback`
  );
  console.assert(
    ratings.breakdown && typeof ratings.breakdown[5] === 'number',
    'Ratings should contain 5-star count in breakdown'
  );
  console.assert(
    typeof ratings.average === 'number' && ratings.average >= 4.0,
    `Average rating should be valid number, got ${ratings.average}`
  );
  console.log(`✓ Partner ratings scorecard: ${ratings.average}/5 with ${ratings.total_reviews} reviews`);
  console.log('✓ Customer rating and feedback successfully reflected in recent reviews!');

  console.log('--- ALL TESTS PASSED SUCCESSFULLY! ---');
}

runTests().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
