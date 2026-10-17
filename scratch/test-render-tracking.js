import React from 'react';
import { renderToString } from 'react-dom/server';
import LiveTrackingView from '../client/src/pages/customer/LiveTrackingView.jsx';
import CustomerLayout from '../client/src/components/customer/CustomerLayout.jsx';
import socketService from '../client/src/services/socketService.js';

console.log('Testing socketService methods:');
console.log('socketService.on exists?', typeof socketService.on === 'function');
console.log('socketService.off exists?', typeof socketService.off === 'function');

const testCases = [
  { name: 'Null activeRequest', data: null },
  { name: 'Empty activeRequest', data: {} },
  { name: 'Partner is null', data: { id: 'test-1', status: 'accepted', partner: null } },
  { name: 'Partner is undefined', data: { id: 'test-2', status: 'partner_on_way' } },
  { name: 'Partner is string', data: { id: 'test-3', status: 'partner_arrived', partner: 'Shlok Jain' } },
  { name: 'Step 4 Service Started', data: { id: 'test-4', status: 'service_started', step_index: 4, service_otp: '123456' } },
  { name: 'Step 5 Service Completed (Customer sees Proceed to Payment)', data: { id: 'test-5', status: 'service_completed', step_index: 5, order_number: 'ORD-8888', partner: { name: 'Shlok Jain' } } },
  { name: 'Step 6 Payment Completed (Customer sees Payment Confirmation)', data: { id: 'test-6', status: 'payment_completed', step_index: 6, order_number: 'ORD-9999', partner: { name: 'Shlok Jain' } } },
  {
    name: 'Mohit Real DB Request',
    data: {
      id: "97e6e93e-7e5d-416e-8045-acb9c3d55e09",
      customer_id: "fc780d8e-39a1-40c6-bc6b-6185c1eef30c",
      partner_id: "b25ad5ab-6a23-48e0-aca7-6cf2793d704d",
      service_id: 12,
      problem: "Kitchen sink drain",
      description: "isolated water power but the sink is leaking",
      address: "Bhoomi Towers, Sector 17, Nerul, Navi Mumbai.",
      status: "partner_arrived",
      service_otp: "498943",
      order_number: "ORD-97E6",
      step_index: 3,
      partner: {
        id: "b25ad5ab-6a23-48e0-aca7-6cf2793d704d",
        name: "Shlok Jain",
        phone: "9766732615",
        rating: "5.00",
        vehicle: "Activa / Scooter"
      }
    }
  }
];

let failed = 0;
for (const tc of testCases) {
  try {
    const html = renderToString(
      React.createElement(
        CustomerLayout,
        {
          activeTab: 'tracking',
          onNavigate: () => {},
          activeRequest: tc.data,
          customer: { name: 'Mohit Kumar', phone: '8767543403' },
          theme: 'light',
          setTheme: () => {},
          onLogout: () => {},
        },
        React.createElement(LiveTrackingView, {
          activeRequest: tc.data,
          onNavigate: () => {},
          onCancel: () => {},
        })
      )
    );
    console.log(`  ✓ ${tc.name} rendered cleanly (HTML size: ${html.length} bytes)`);
  } catch (err) {
    console.error(`  ✗ ${tc.name} failed:`, err);
    failed++;
  }
}

if (failed > 0) {
  console.error(`\nFAILED ${failed} test(s)`);
  process.exit(1);
} else {
  console.log(`\nALL ${testCases.length} EDGE CASES PASSED WITH 0 ERRORS!`);
}
