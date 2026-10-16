# FixIt Now: Implementation Plan

Version 1.1 · 16 October 2026 · Companion to the FixIt Now SRS

## 1. Goal and Approach
Build FixIt Now in vertical slices. The UI is built first with sample data so the look can be judged early, then the database and backend are added and wired into the screens phase by phase. The first working target on the backend side is: customer creates a request, a partner accepts it, and the customer sees live status ticks.

### 1.1 Build order (matches PROMPTS.md)
1. Prompt 0: project setup
2. Prompt 1: landing page (Phase 2)
3. Prompts 2 to 4: customer, partner and admin screens with sample data
4. Prompt 5: database and backend foundation (Phase 1)
5. Prompt 6: authentication (Phase 3)
6. Prompt 7: partner subscription and KYC (Phase 4)
7. Prompt 8: admin core (Phase 5)
8. Prompt 9: customer requests and matching (Phase 6)
9. Prompt 10: live job flow and tracking (Phase 7)
10. Prompt 11: payment, ratings, history and earnings (Phase 8)
11. Prompt 12: admin analytics (Phase 9)
12. Prompt 13: polish, testing and demo prep (Phase 10)

The phase numbers below keep their original numbering so they match the "Plan Phase N" labels in the prompts.

**Sample data rule:** until the backend exists, every screen uses sample data from `client/src/mockData/` with the same field names and status values as section 6 of the SRS, loaded only through service files in `client/src/services/`. When a backend phase is done, the mock data for those screens is replaced by real API calls.

## 2. Technology Stack
| Layer | Choice | Why |
|---|---|---|
| Frontend | React with React Router | Component reuse across three portals |
| Styling | Tailwind CSS | Fast, consistent, responsive UI |
| Backend | Node.js with Express | Simple REST API, same language as frontend |
| Database | PostgreSQL | Relational data: users, requests, subscriptions |
| Real-time | Socket.IO | Status ticks, partner movement, cancellations |
| Auth | JWT with bcrypt password hashing | Stateless, role-based access |
| Uploads | Multer | KYC PDFs and photos |
| OTP | Nodemailer (email) or console fallback | Forgot password and service OTP |
| Geocoding | OpenStreetMap Nominatim with cache | Free, street-level accuracy |
| Charts | Recharts | Admin analytics |
| Map | Custom SVG canvas | Simple partner movement and ETA |

## 3. Architecture Overview
The React app talks to the Express API over HTTPS for data and to Socket.IO over WebSocket for live updates. The API contains separate modules: auth, customers, partners, requests, matching, subscriptions, KYC, payments, ratings, notifications and admin. PostgreSQL stores all data; uploaded files are stored on disk with their paths in the database.

### 3.1 Suggested folder structure
- `client/`: `pages/` (landing, customer, partner, admin), `components/`, `services/` (API and socket clients), `mockData/`, `context/` (auth)
- `server/`: `routes/`, `controllers/`, `models/`, `middleware/` (auth, role checks, upload), `services/` (matching, geocoding, simulation, subscription checks), `sockets/`
- `db/`: schema and seed scripts
- `docs/`: SRS.md, PLAN.md, DESIGN.md

### 3.2 Key real-time events
- `request:new` to a partner, `request:accepted`, `request:declined`, `request:timeout`
- `status:update` to the customer for each job step
- `partner:location` for simulated movement and ETA
- `request:cancelled` to the partner

## 4. Phases
Durations assume one to two developers and are estimates to adjust to your deadline.

### Phase 1: Foundation (about 3 days)
- Set up repositories, project structure, database and environment config.
- Create the database schema for all entities in the SRS and a seed script (admin account, services, plans, demo partners).
- Build the common layout, navbar and routing.

**Done when:** the app runs, connects to the database and the admin account exists.

### Phase 2: Landing page (about 2 days)
- Build all landing sections: hero with customer and partner tickets, services, how it works from both sides, why FixIt Now, About us, FAQ and footer.
- Load services from the database once the backend exists.

**Done when:** the landing page is complete and responsive.

### Phase 3: Authentication (about 3 days)
- Customer and partner registration with validation (password of at least 6 characters and one special character).
- Login, JWT sessions and role-based route guards.
- Forgot password with OTP; separate admin login at `/admin/login`.

**Done when:** all three roles can log in and are kept out of each other's routes.

### Phase 4: Partner subscription and KYC (about 4 days)
- Plan selection after registration (quarterly, half-yearly, yearly) with simulated payment.
- Subscription records with start and end dates, expiry lock and warnings.
- KYC upload (PDFs and passport photo) with pending, verified and rejected states.
- Partner dashboard gating: "Complete KYC verification" until verified.

**Done when:** a partner can register, subscribe, submit KYC and see the right dashboard state.

### Phase 5: Admin core (about 3 days)
- KYC review screen: approve or reject.
- Plan price management (applies to new subscriptions only) and service category management.
- Read-only lists of customers, partners, requests, subscriptions, ratings and the activity log.

**Done when:** admin can verify a partner so the partner can start receiving requests.

### Phase 6: Request creation and matching (about 5 days)
- Customer dashboard, address saving and geocoding with caching and fallbacks.
- Create-request flow with service, problem, description, optional photo and price estimate.
- Matching service: filter online, verified, subscribed partners of the right service, compute haversine distance, keep those within 2 km, sort nearest first.
- Offer to the nearest partner with a countdown; on decline or timeout, offer to the next. If none remain, return "All partners busy, try again later".
- Customer searching screen and partner incoming-request popup.

**Done when:** a request reaches the right partner, and the busy case works.

### Phase 7: Live job flow and tracking (about 5 days)
- Partner status buttons: Accept, Start trip, Arrived, Start service, Complete service, Payment received.
- Customer tracking screen with six green ticks updated through Socket.IO.
- Simulated partner movement along a straight line with ETA countdown on the custom SVG map.
- Service OTP check before starting the service.
- Customer cancellation with reason and instant partner notification; the partner is freed for new jobs.

**Done when:** a full job runs from request to payment with live ticks on the customer side.

### Phase 8: Payment, ratings, history and earnings (about 3 days)
- Simulated payment states: proceed, waiting, successful, plus receipts.
- Rating of the partner after service.
- Request history for both sides, partner earnings with breakdown, ratings view.
- Notifications and support page.

**Done when:** completed and cancelled jobs appear in history and earnings update after payment.

### Phase 9: Admin analytics (about 3 days)
- Charts for requests over time, top services, completion versus cancellation, partner and customer growth, subscription revenue, peak hours and top-rated partners.
- Live users view.

**Done when:** every analytics item from the SRS is shown with real data.

### Phase 10: Polish, testing and demo prep (about 4 days)
- Empty, loading and error states; mobile responsiveness.
- End-to-end testing of all flows; security review of routes and uploads.
- Seed demo data and rehearse the demo script.

**Done when:** the demo runs cleanly start to finish.

## 5. Overall Timeline
Roughly 35 days of work in total, or about 5 to 6 weeks. The critical path is the authentication, subscription and KYC, admin core, matching and live tracking phases, because matching and live tracking cannot be demonstrated until a verified, subscribed partner exists.

## 6. Testing Strategy
- **Unit tests**: distance calculation, eligibility filter, password rules, subscription expiry, plan price handling.
- **API tests**: auth, role guards, request lifecycle, KYC and admin actions.
- **Manual end-to-end scenarios**: see the demo checklist below.
- **Real-time checks**: two browsers (customer and partner) to confirm tick updates, cancellation and movement.

## 7. Demo Checklist
1. Landing page walkthrough.
2. Register a partner, subscribe, submit KYC; admin approves.
3. Register a customer and create a request with a real street and area address.
4. Partner within 2 km accepts; walk through all status buttons while the customer sees live ticks, movement and ETA.
5. Service OTP, payment, rating, receipt and history.
6. Customer cancels a second request; partner is notified.
7. Request from an address more than 2 km away shows "All partners busy".
8. Admin views analytics and changes a plan price; show that existing partners keep what they paid.

## 8. Risks and Mitigations
| Risk | Mitigation |
|---|---|
| Geocoding fails or is slow | Cache results; fall back to area name, then simulated coordinates |
| Real-time updates drop during demo | Reconnect logic and a quick refresh fallback on the tracking screen |
| No eligible partner during demo | Seed demo partners at real nearby areas and keep them online |
| Scope too large for the deadline | Build core loop first; treat extras (photo upload, receipts, support page) as last |
| KYC uploads misuse | File type and size limits, files stored outside the public path |
| Sample data and real data differ | Sample data uses the SRS field names; screens load data only through service files |

## 9. Open Items to Confirm
- Offer timeout length per partner (suggested 30 seconds, configurable).
- Demo city and areas to seed partners in.
- Whether OTPs are emailed or shown on screen for the demo.
- Your submission deadline, so the phase durations can be adjusted.
