/**
 * FixIt Now - Mock Data Store
 * Conforms to SRS Section 6 entity schemas and status enumerations.
 */

export const mockServices = [
  { id: 1, name: 'Electrical Work', slug: 'electrical', base_price_estimate: 350.0, active: true },
  { id: 2, name: 'Plumbing Service', slug: 'plumbing', base_price_estimate: 300.0, active: true },
  { id: 3, name: 'Carpentry Repairs', slug: 'carpentry', base_price_estimate: 400.0, active: true },
  { id: 4, name: 'Appliance Repair', slug: 'appliance', base_price_estimate: 450.0, active: true },
];

export const mockPlans = [
  { id: 1, name: 'Quarterly', duration_months: 3, price: 899.0, active: true },
  { id: 2, name: 'Half-yearly', duration_months: 6, price: 1599.0, active: true },
  { id: 3, name: 'Yearly', duration_months: 12, price: 2799.0, active: true },
];
