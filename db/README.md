# FixIt Now - Database Schema & Setup

This directory contains the database migration and schema scripts for FixIt Now.

## Relational Database

FixIt Now uses **PostgreSQL**.
In Phase 1 / Prompt 5, the schema and seeds are loaded into PostgreSQL.

## Entity Overview (SRS Section 6)

- **customers**: User accounts for customers requesting home services.
- **saved_addresses**: Customer saved addresses with geocoded coordinates.
- **partners**: Registered and subscribed service providers offering exactly 1 service category.
- **kyc_documents**: Partner identity verification documents (PDF / photo).
- **plans**: Subscription tiers (Quarterly, Half-yearly, Yearly).
- **subscriptions**: Partner subscription purchase history and expiry tracking.
- **services**: Available service categories (Plumbing, Electrical, Carpentry, Appliance Repair, etc.).
- **requests**: On-demand service requests with live status progression.
- **request_status_logs**: Audit trail of request status transitions.
- **payments**: Simulated payment transactions and receipts.
- **ratings**: Customer ratings and reviews for partners.
- **notifications**: System notifications for users.
- **activity_logs**: Admin audit log.
- **otps**: One-time passwords for password recovery and service verification.
