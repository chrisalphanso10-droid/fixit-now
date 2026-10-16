# FixIt Now: Software Requirements Specification (SRS)

Version 1.0 · 16 October 2026 · Prepared for the FixIt Now project

## 1. Introduction

### 1.1 Purpose
This document specifies the requirements for **FixIt Now**, an on-demand home-services marketplace in the style of Rapido. Customers at home request a service such as electrical or plumbing work, and the nearest verified service partner accepts the job. It is intended for the project team, evaluators and anyone building or testing the system.

### 1.2 Scope
FixIt Now is a web application with three portals (customer, partner and admin) and a public landing page. Requests are immediate only; there is no scheduling. The platform earns no commission. Partners pay a subscription (quarterly, half-yearly or yearly) to use it. Customer payments for services are simulated.

### 1.3 Definitions
- **Customer**: a person who requests a home service.
- **Partner**: a service professional (electrician, plumber, etc.) offering exactly one service category.
- **Admin**: the single pre-created platform administrator.
- **KYC**: identity verification documents submitted by a partner.
- **Request**: a customer's job booking with a service, problem and description.
- **Eligible partner**: a partner who is online, KYC-verified, holds an active subscription and is within 2 km of the customer.

### 1.4 Overview
Section 2 describes the product context. Section 3 lists functional requirements by portal. Sections 4 to 7 cover interfaces, non-functional requirements, data and business rules. Section 8 lists assumptions and out-of-scope items.

## 2. Overall Description

### 2.1 Product perspective
A standalone web system with a React frontend, a Node.js (Express) REST API, a PostgreSQL database and Socket.IO for real-time updates. Addresses are converted to coordinates with OpenStreetMap Nominatim. Partner movement on the tracking screen is simulated.

### 2.2 User classes
| User | Description | Access |
|---|---|---|
| Visitor | Unregistered public user | Landing page only |
| Customer | Registered requester | Customer portal |
| Partner | Registered, subscribed service provider | Partner portal; job features only after KYC verification |
| Admin | One pre-created account | Admin portal at `/admin/login` |

### 2.3 Operating environment
Modern desktop and mobile browsers (Chrome, Edge, Firefox, Safari). Server runs on Node.js with PostgreSQL.

### 2.4 Constraints
- Immediate requests only; no scheduling.
- Matching radius is fixed at 2 km.
- Each partner offers one service only.
- Admin cannot modify customer or partner data.
- Payments are simulated; no real payment gateway.

### 2.5 Assumptions
- Demo addresses contain real street and area names but not exact flat or building details. Street-level geocoding accuracy is sufficient for the 2 km radius.
- If an address cannot be geocoded, simulated coordinates are saved so the booking is never blocked.
- Users have a working internet connection and a modern browser.

## 3. Functional Requirements

### 3.1 Landing page
- **FR-L1**: Show logo and name, and a navbar with Login and Sign up.
- **FR-L2**: Hero section with "Join as customer" and "Join as partner" actions.
- **FR-L3**: Sections for Services, Why FixIt Now, About us, How it works, Help/FAQ, partner call-to-action and footer.
- **FR-L4**: Service categories and (optionally) FAQ and landing content are editable by admin.

### 3.2 Customer portal

**Registration and login**
- **FR-C1**: Register with name, email, password, phone and address, saved in the backend.
- **FR-C2**: Password must be at least 6 characters and contain at least one special character.
- **FR-C3**: Login with email and password.
- **FR-C4**: Forgot password using an OTP.

**Dashboard**
- **FR-C5**: Show the services offered.
- **FR-C6**: Create a request with service, problem and description. Requests are immediate only.
- **FR-C7**: Show request history, including completed and cancelled requests.
- **FR-C8**: Editable profile.
- **FR-C9**: Saved addresses, optional photo upload on a request, and a price estimate before booking.

**Matching and tracking**
- **FR-C10**: On request, the system searches for the nearest eligible partner within 2 km.
- **FR-C11**: A searching screen is shown while matching runs.
- **FR-C12**: If no eligible partner is found or the offer times out, show "All partners busy, try again later".
- **FR-C13**: After acceptance, show a partner details card.
- **FR-C14**: A live tracking screen shows, with a green tick for each step as it happens in real time: Request accepted, Partner on the way, Partner arrived, Service started, Service completed, Payment completed.
- **FR-C15**: A simple custom map shows the partner moving toward the customer, with an ETA.
- **FR-C16**: A service OTP is shown to the customer and confirmed before the service starts.

**After service**
- **FR-C17**: Customer rates the partner.
- **FR-C18**: Simulated payment flow: proceed, waiting, successful. A receipt is available afterwards.
- **FR-C19**: Customer can cancel a request with a reason. The partner is notified instantly and the customer gets a "Go to dashboard" option.
- **FR-C20**: Notifications, a support page, and clear empty and error states.

### 3.3 Partner portal

**Registration, subscription and KYC**
- **FR-P1**: Register with the same fields as a customer plus exactly one service category.
- **FR-P2**: After registering, choose a plan: quarterly, half-yearly or yearly. Longer plans cost less per month.
- **FR-P3**: Only subscribed partners can use the site.
- **FR-P4**: Submit KYC: PDF documents plus a passport photo in JPEG or PNG.
- **FR-P5**: KYC states: pending, verified, rejected. Admin decides.
- **FR-P6**: Login with email and password, with forgot password via OTP.

**Dashboard and jobs**
- **FR-P7**: If verified, show incoming requests that can be accepted or declined, with a countdown. If not verified, show "Complete KYC verification".
- **FR-P8**: Online/offline toggle. Only online partners receive requests.
- **FR-P9**: On an accepted job, status buttons in order: Accept, Start trip, Arrived, Start service, Complete service, Payment received. Each one updates the customer's tracking screen in real time.
- **FR-P10**: Live location sharing during the trip (simulated movement).
- **FR-P11**: Request history, ratings view, editable profile.
- **FR-P12**: Earnings, updated after payment, with a breakdown.
- **FR-P13**: Show the current plan and time remaining.
- **FR-P14**: Plan upgrade, paid after the current plan expires.
- **FR-P15**: Warnings before expiry; the portal locks when the plan expires.

### 3.4 Admin portal
- **FR-A1**: Login only, no registration. One pre-created account on a separate `/admin/login` route.
- **FR-A2**: Read-only monitoring of registered customers and partners, live users, all requests, earnings, subscriptions, ratings and an activity log.
- **FR-A3**: Admin cannot modify any customer or partner data.
- **FR-A4**: Admin can approve or reject partner KYC.
- **FR-A5**: Admin can change plan prices. A change applies only to new subscriptions.
- **FR-A6**: Admin can manage service categories (and possibly FAQ and landing content).
- **FR-A7**: Analytics: requests over time, top services, completion versus cancellation, partner and customer growth, subscription revenue, peak hours and top-rated partners.

### 3.5 Matching and assignment logic
- **FR-M1**: Convert the customer's address to coordinates with geocoding. Fall back to the area name, then to simulated coordinates.
- **FR-M2**: Compute distance between customer and each partner with the haversine formula.
- **FR-M3**: A partner is eligible only if online, KYC-verified, subscribed with an unexpired plan, offering the requested service, and within 2 km.
- **FR-M4**: Offer the request to the nearest eligible partner. If the partner declines or does not respond in time, offer it to the next nearest eligible partner automatically.
- **FR-M5**: If no eligible partner remains, the request times out and the customer sees "All partners busy, try again later".
- **FR-M6**: A partner may hold only one active job at a time.

### 3.6 Real-time tracking
- **FR-T1**: Every status change is pushed to the customer instantly through Socket.IO.
- **FR-T2**: On Start trip, partner position moves in simulated steps toward the customer, and the ETA counts down.
- **FR-T3**: Cancellation by the customer is pushed to the partner instantly.

## 4. External Interface Requirements
- **User interface**: Responsive web UI for all portals, usable on phones and desktops.
- **Software interfaces**: OpenStreetMap Nominatim for geocoding (with a User-Agent header, about one request per second, and cached results). Email or console delivery of OTPs.
- **Communication**: HTTPS REST for data, WebSocket (Socket.IO) for live updates.
- **File uploads**: PDF for KYC documents, JPEG and PNG for photos, with size limits.

## 5. Non-Functional Requirements
- **Security**: Passwords hashed with bcrypt; JWT-based sessions; role-based access so customers, partners and admin cannot reach each other's routes; input validation; file type and size checks on uploads.
- **Performance**: Matching result within a few seconds; status updates reach the customer in under one second on a normal connection.
- **Reliability**: Geocoding failures never block a booking; coordinates are cached with the address.
- **Usability**: Clear states for loading, empty lists and errors; mobile-friendly layouts.
- **Maintainability**: Modular backend (auth, requests, matching, subscriptions, admin) and reusable frontend components.
- **Auditability**: Admin activity log records key events such as KYC decisions and price changes.

## 6. Data Requirements
Main entities:
- **Customer**: name, email, password hash, phone, address, coordinates, photo.
- **SavedAddress**: customer, label, address, coordinates.
- **Partner**: personal fields, one service, online flag, current coordinates, KYC status, rating.
- **KYCDocument**: partner, file paths, status, reviewer decision.
- **Plan**: name (quarterly, half-yearly, yearly), duration, price.
- **Subscription**: partner, plan, price paid, start, end, status.
- **Service**: category name, base price estimate, active flag.
- **Request**: customer, partner, service, problem, description, address, coordinates, status, cancel reason, service OTP, timestamps.
- **RequestStatusLog**: request, status, time.
- **Payment**: request, amount, simulated status, receipt.
- **Rating**: request, partner, stars, comment.
- **Notification**: recipient, message, read flag.
- **ActivityLog**: actor, action, time.
- **OTP**: target, code, expiry, purpose.

## 7. Business Rules
- **BR-1**: No commission is charged on jobs. Revenue is partner subscriptions only.
- **BR-2**: A plan price change applies to new subscriptions only; existing partners keep the price they paid.
- **BR-3**: A plan upgrade is paid after the current plan expires.
- **BR-4**: Partners with an expired plan are locked out of job features.
- **BR-5**: Only KYC-verified partners receive requests.
- **BR-6**: Completed and cancelled requests are kept in history for both sides.
- **BR-7**: Partner earnings update only after payment is marked received.

## 8. Assumptions and Out of Scope
- No scheduled or future bookings.
- No real payment gateway; payment is simulated.
- No real-time GPS requirement; movement is simulated.
- No admin editing of customer or partner profiles.
- Native mobile apps are not included; the web app is responsive.
