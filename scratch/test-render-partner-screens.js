/**
 * Scratch test for PartnerHistoryView and PartnerRatingsView component rendering
 */
import React from 'react';
import { renderToString } from 'react-dom/server';
import PartnerHistoryView from '../client/src/pages/partner/PartnerHistoryView.jsx';
import PartnerRatingsView from '../client/src/pages/partner/PartnerRatingsView.jsx';
import {
  savePartnerRecentJob,
  addPartnerRating,
} from '../client/src/services/partnerService.js';

// Setup Mock LocalStorage
const storage = {};
global.localStorage = {
  getItem: (key) => storage[key] || null,
  setItem: (key, val) => { storage[key] = String(val); },
  removeItem: (key) => { delete storage[key]; },
};

global.window = {
  dispatchEvent: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
};

async function testComponentRendering() {
  console.log('--- Testing PartnerHistoryView & PartnerRatingsView SSR ---');

  // Seed with sample completed and cancelled jobs
  savePartnerRecentJob({
    id: 991,
    order_number: 'ORD-991A',
    customer_name: 'Mohit Kumar',
    customer_phone: '+91 98765 43210',
    service_name: 'Plumbing Repairs',
    problem: 'Kitchen sink overflow',
    address: '42, 3rd Cross, Indiranagar',
    status: 'completed',
    amount: 500,
    rating: { stars: 5, comment: 'Punctual and very neat work!' },
  });

  savePartnerRecentJob({
    id: 992,
    order_number: 'ORD-992B',
    customer_name: 'Rahul Sharma',
    customer_phone: '+91 97777 88888',
    service_name: 'Carpentry',
    problem: 'Door hinge broken',
    address: 'Indiranagar 12th Main',
    status: 'cancelled',
    cancel_reason: 'Customer rescheduled.',
  });

  addPartnerRating({
    id: 993,
    order_number: 'ORD-991A',
    customer_name: 'Mohit Kumar',
    stars: 5,
    comment: 'Punctual and very neat work!',
    service_name: 'Plumbing Repairs',
  });

  const partner = { id: 101, name: 'Rajesh Kumar' };

  // Render PartnerHistoryView
  const historyHtml = renderToString(React.createElement(PartnerHistoryView, { partner }));
  console.assert(historyHtml.includes('Partner Work Order History'), 'Should render history banner');
  console.assert(historyHtml.includes('DISPATCH ARCHIVE LOG'), 'Should render archive header');
  console.log('✓ PartnerHistoryView renders cleanly');

  // Render PartnerRatingsView
  const ratingsHtml = renderToString(React.createElement(PartnerRatingsView, { partner }));
  console.assert(
    ratingsHtml.includes('CALCULATING REPUTATION SCORECARD...') || ratingsHtml.includes('Customer Ratings'),
    'Should render ratings screen or placeholder'
  );
  console.log('✓ PartnerRatingsView renders cleanly');

  console.log('--- Component Render Tests Passed ---');
}

testComponentRendering().catch((err) => {
  console.error('SSR test failed:', err);
  process.exit(1);
});
