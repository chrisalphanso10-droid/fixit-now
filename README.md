# FixIt Now — On-Demand Home-Services Marketplace

> A trade-inspired, work-order styled on-demand home-services marketplace connecting homeowners with verified local electricians, plumbers, carpenters, and appliance repair specialists within a 2 km radius.

---

## 1. Tech Stack

- **Frontend:** React (Vite) + Tailwind CSS
- **Backend:** Node.js + Express REST API
- **Real-Time:** Socket.IO _(Phases 6–7)_
- **Database:** PostgreSQL (`db/schema.sql`)
- **Authentication:** JWT + bcrypt _(Phase 3)_
- **File Uploads:** Multer _(Phase 4)_
- **Code Quality:** ESLint + Prettier

---

## 2. Design System & Aesthetic (`docs/DESIGN.md`)

FixIt Now strictly adheres to the tradesperson's **work order** aesthetic:

- **Paper Tickets & Ink:** `#FBFAF6` (`paper`) cards with `2px solid #111418` (`ink`) borders on `#EDEEE9` (`concrete`) background.
- **Accents:** `#FF5B14` (`signal`) as the sole primary accent; `#1E8C4E` (`done`) for verified status & completion ticks.
- **Geometry:** 100% square corners (`border-radius: 0`).
- **Hard Offset Shadows:** `9px 9px 0 #111418` (`shadow-hard`), `5px 5px 0 #111418` (`shadow-hard-sm`), and `9px 9px 0 #FF5B14` (`shadow-hard-signal`).
- **Dividers & Rulers:** 2px dashed tear lines and 30px tape-measure ruler strips with repeating tick marks.
- **Typography:**
  - Headings / Logo: **Bricolage Grotesque** (600, 800)
  - Body & Controls: **DM Sans** (400, 500, 700)
  - Labels, Numbers, Status: **DM Mono** (500) uppercase

---

## 3. Project Structure

```
├── client/                     # Frontend Application (React + Vite + Tailwind)
│   ├── public/                 # Static assets and favicon
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   ├── context/            # Auth and application state
│   │   ├── mockData/           # Mock data matching SRS Section 6
│   │   ├── pages/              # Portal pages (Landing, Customer, Partner, Admin)
│   │   ├── services/           # API and Socket.IO service connectors
│   │   │   ├── api.js          # Core HTTP client with fallback
│   │   │   └── healthService.js # Health check diagnostic service
│   │   ├── App.jsx             # Diagnostic Work Order & Health Check Page
│   │   ├── index.css           # Tailwind base, components, and ruler utilities
│   │   └── main.jsx            # React root mount
│   ├── .env.example            # Client environment variables
│   ├── tailwind.config.js      # Custom theme tokens, fonts, and shadows
│   └── vite.config.js          # Vite config with API reverse proxy
│
├── server/                     # Backend API (Node.js + Express)
│   ├── src/
│   │   ├── controllers/        # Request handlers (e.g., health.controller.js)
│   │   ├── routes/             # Route definitions (e.g., health.routes.js)
│   │   ├── app.js              # Express application configuration & middleware
│   │   └── server.js           # Server entrypoint and graceful shutdown
│   ├── .env.example            # Server environment variables
│   └── package.json            # Server scripts and dependencies
│
├── db/                         # Database Architecture
│   ├── schema.sql              # Initial PostgreSQL schema (SRS Section 6 entities)
│   └── README.md               # Database entity dictionary and setup notes
│
├── docs/                       # Specifications & Design Guides (Source of Truth)
│   ├── DESIGN.md               # UI design rules, tokens, and prohibited patterns
│   ├── PLAN.md                 # Phased implementation plan
│   └── SRS.md                  # Software Requirements Specification
│
├── .env.example                # Unified environment variables template
├── .gitignore                  # Git ignore rules for builds, modules, and secrets
├── .prettierrc                 # Code formatting standard
└── eslint.config.js            # Unified flat ESLint configuration
```

---

## 4. Getting Started

### Prerequisites

- **Node.js** (v18+ recommended; tested on v24)
- **npm** (v9+ recommended; tested on v11)

### Installation

Run `npm install` in the root and in both the `client` and `server` folders:

```bash
# Install root dev tools (ESLint, Prettier)
npm install

# Install server dependencies
cd server && npm install && cd ..

# Install client dependencies
cd client && npm install && cd ..
```

---

## 5. Running the Application

Both client and server start with **one command each**:

### Terminal 1: Backend Server

```bash
cd server
npm run dev
```

_Server starts on `http://localhost:5000` with hot-reloading (`node --watch`)._

### Terminal 2: Frontend Client

```bash
cd client
npm run dev
```

_Client starts on `http://localhost:5173` with Vite HMR._

_(Alternatively, run from root using `npm run dev:server` and `npm run dev:client`)_

---

## 6. Mobile Phone QR Scan & Network Setup (Item 3)

To test subscription payments on a physical phone camera:

1. **Connect to Same Network:** Ensure your laptop and phone are connected to the same Wi-Fi network (or connect your laptop to your phone's personal mobile hotspot).
2. **Find Your Laptop's Local IP:** Open a terminal / PowerShell and run:
   ```cmd
   ipconfig
   ```
   Locate your active adapter's **IPv4 Address** (e.g. `192.168.0.105` or `192.168.43.xxx`).
3. **Configure `server/.env`:**
   Set `PUBLIC_BASE_URL` to your laptop's IP and server port:
   ```env
   PUBLIC_BASE_URL=http://192.168.0.105:5001
   UPI_ID=fixitnow@demo
   ```
4. **Windows Firewall:** Ensure your active Wi-Fi connection profile is set to **Private network** (or allow Node.js through Windows Defender Firewall when prompted) so incoming connections on port `5001` are accepted. The backend automatically listens on `0.0.0.0` so all local network interfaces are reachable.
5. **Scan & Pay:** Open the Partner portal plan selection or upgrade screen, point your phone's camera app at the generated QR code, and tap the link. The page confirms the payment and your partner screen live-updates within 2.5 seconds.

---

## 7. Verification

1. Open your browser and navigate to: **`http://localhost:5173`**
2. You will see the **FixIt Now Diagnostic Work Order ticket** styled per `docs/DESIGN.md`.
3. The page connects to `GET /api/health` and displays:
   - Status: `HTTP 200 OK — CONNECTED`
   - Stamp badge: `SERVER ONLINE`
   - Server uptime, target service name, version, and roundtrip ping latency
4. Click **"RUN HEALTH PING"** to test live API polling and round-trip latency.
5. Click **"VIEW RAW JSON"** or navigate directly to `http://localhost:5000/api/health` to inspect the raw JSON response.

---

## 7. Linting & Formatting

```bash
# Run ESLint across client and server
npm run lint

# Format codebase with Prettier
npm run format
```
