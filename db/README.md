# FixIt Now - Database Schema & Setup

This directory contains the database migration, schema, and seed scripts for FixIt Now.

## Relational Database Architecture

FixIt Now uses **PostgreSQL**.
Conforms to **docs/SRS.md Section 6 (Data Requirements)** and **docs/PLAN.md (Phase 1)**.

---

## Entity Overview (SRS Section 6)

1. **admins**: Platform administrator account with bcrypt hashed password.
2. **services**: 5 Core service categories (Electrician, Plumber, Carpenter, AC repair, Appliance repair).
3. **customers**: Customer user accounts with geocoded coordinates.
4. **saved_addresses**: Customer saved addresses (Home, Office, Parents) with coordinates.
5. **partners**: Certified tradespeople offering 1 service category, with live coordinates and KYC status.
6. **kyc_documents**: Identity verification documents (Aadhaar, photo, trade certificate).
7. **plans**: Subscription tiers (quarterly, half-yearly, yearly with longer = cheaper per month).
8. **subscriptions**: Partner subscription purchase history, active duration, and expiry.
9. **requests**: On-demand service requests with live status progression and service OTP.
10. **request_status_logs**: Audit trail of request status transitions.
11. **payments**: Simulated payment transactions and receipts.
12. **ratings**: Customer ratings (1-5 stars) and reviews for partners.
13. **notifications**: In-app notifications for customers, partners, and admin.
14. **activity_logs**: Admin audit log recording platform events.
15. **otps**: One-time passwords for password recovery and service verification.

---

## How to Run Schema & Seed

### 1. Apply Database Schema
Creates all 15 tables, constraints, foreign keys, and indexes (including spatial coordinate indexes):
```bash
# Via Node.js migration runner:
npm run db:schema

# Or directly via psql:
psql "postgresql://fixitnow:CCA142005@localhost:5432/fix_it_now" -f db/schema.sql
```

### 2. Seed Baseline Data
Seeds the admin account (from `.env`), the 5 services, 3 subscription plans, and 4 demo partners:
```bash
# Via Node.js seed script (dynamically reads .env & hashes passwords with bcrypt):
npm run db:seed

# Or directly via psql:
psql "postgresql://fixitnow:CCA142005@localhost:5432/fix_it_now" -f db/seed.sql
```

---

## How to Verify and Query the Tables

Verify table creation and seed data:
```bash
# 1. Check all tables
psql "postgresql://fixitnow:CCA142005@localhost:5432/fix_it_now" -c "\dt"

# 2. Query seeded Admin account
psql "postgresql://fixitnow:CCA142005@localhost:5432/fix_it_now" -c "SELECT id, email, name, created_at FROM admins;"

# 3. Query 5 service categories
psql "postgresql://fixitnow:CCA142005@localhost:5432/fix_it_now" -c "SELECT id, name, slug, active FROM services;"

# 4. Query 3 subscription plans (verify longer = cheaper per month)
psql "postgresql://fixitnow:CCA142005@localhost:5432/fix_it_now" -c "SELECT id, name, duration_months, price, ROUND(price / duration_months, 2) AS monthly_rate FROM plans;"

# 5. Query 4 demo partners with coordinates and KYC status
psql "postgresql://fixitnow:CCA142005@localhost:5432/fix_it_now" -c "SELECT p.name, s.name AS service, p.online, p.kyc_status, p.latitude, p.longitude, p.rating FROM partners p JOIN services s ON p.service_id = s.id;"
```

---

## Health Check API
You can also verify backend database connectivity at runtime:
```bash
curl http://localhost:5000/api/health
```
