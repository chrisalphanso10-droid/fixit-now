/**
 * FixIt Now - Mock Data Store
 * Conforms to SRS Section 6 entity schemas and status enumerations.
 */

export const mockServices = [
  {
    id: 1,
    name: 'Electrical Work',
    slug: 'electrical',
    description:
      'Wiring fixes, short circuits, switchboards, fixtures and circuit breaker diagnostics.',
    base_price_estimate: 350.0,
    active: true,
  },
  {
    id: 2,
    name: 'Plumbing Repairs',
    slug: 'plumbing',
    description: 'Pipe leaks, tap replacements, drain blocks, flush repairs and sanitary fittings.',
    base_price_estimate: 300.0,
    active: true,
  },
  {
    id: 3,
    name: 'Carpentry & Woodwork',
    slug: 'carpentry',
    description:
      'Door alignment, hinge fixes, lock replacements, furniture repairs and cabinet latches.',
    base_price_estimate: 400.0,
    active: true,
  },
  {
    id: 4,
    name: 'Appliance Repair',
    slug: 'appliance',
    description:
      'Washing machines, microwave ovens, water purifiers, refrigerators and chimney repair.',
    base_price_estimate: 450.0,
    active: true,
  },
  {
    id: 5,
    name: 'Painting & Touch-ups',
    slug: 'painting',
    description: 'Patch painting, damp wall repair, water leakage sealing and room repainting.',
    base_price_estimate: 600.0,
    active: true,
  },
  {
    id: 6,
    name: 'Locksmith & Security',
    slug: 'locksmith',
    description: 'Key replacement, jammed lock opening, deadbolt setup and latch replacements.',
    base_price_estimate: 350.0,
    active: true,
  },
  {
    id: 7,
    name: 'Masonry & Tile Fixes',
    slug: 'masonry',
    description: 'Broken tile replacements, floor grouting, cement patches and wall drill repairs.',
    base_price_estimate: 500.0,
    active: true,
  },
  {
    id: 8,
    name: 'AC Service & Repair',
    slug: 'ac-repair',
    description:
      'Filter cleaning, cooling diagnostics, gas top-up and condenser unit troubleshooting.',
    base_price_estimate: 550.0,
    active: true,
  },
];

export const mockPlans = [
  { id: 1, name: 'Quarterly', duration_months: 3, price: 899.0, active: true },
  { id: 2, name: 'Half-yearly', duration_months: 6, price: 1599.0, active: true },
  { id: 3, name: 'Yearly', duration_months: 12, price: 2799.0, active: true },
];

export const mockFaqs = [
  {
    id: 1,
    question: 'How quickly does a partner arrive at my home?',
    answer:
      'FixIt Now matches you only with online, verified partners within a strict 2 km radius. Once a partner accepts your request and starts their trip, average arrival is between 15 and 25 minutes depending on street traffic. You can watch their real-time simulated progress on the tracking ticket.',
  },
  {
    id: 2,
    question: 'How do payments work for services?',
    answer:
      'Payments for services are handled directly between you and the partner upon completion of work. FixIt Now does not collect or process payments on the website, nor are service charges billed online. Once the repair is completed and settled in person, only the confirmation that payment is complete reflects on your live tracking order.',
  },
  {
    id: 3,
    question: 'Why do partners pay subscriptions instead of commissions?',
    answer:
      'FixIt Now charges 0% commission on repairs. Traditional platforms take 20% to 35% of every rupee a tradesperson earns. With our model, verified partners pay a predictable flat subscription (quarterly, half-yearly, or yearly) and keep 100% of the customer payment for their work.',
  },
  {
    id: 4,
    question: 'What happens if no partner is available nearby?',
    answer:
      'Our dispatch system searches for eligible, online, KYC-verified partners within 2 km. If all partners are currently occupied on active jobs or none are within range, the system alerts you immediately with "All partners busy, try again later" so your time is never wasted waiting endlessly.',
  },
];
