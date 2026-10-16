# FixIt Now: DESIGN.md

Every screen in every portal (landing, customer, partner, admin) must follow this file. If a screen needs something not covered here, extend the system in the same spirit and add it to this file. Do not fall back to generic templates.

## 1. Concept: the work order

FixIt Now is a neighbourhood handyman service. The whole interface borrows from a tradesperson's **work order**: paper tickets, stamped marks, dashed tear lines, tape-measure rulers, hard ink outlines. One job has two copies, a **customer copy** and a **partner copy**, with the same job number. Use this idea wherever it fits (request cards, job cards, receipts, the tracking screen).

Tone: direct, local, practical. Bold and a little rough, never glossy.

## 2. Colour

| Token | Hex | Use |
|---|---|---|
| `ink` | `#111418` | Text, borders, dark sections, primary buttons |
| `concrete` | `#EDEEE9` | Page background |
| `paper` | `#FBFAF6` | Ticket and card surfaces |
| `signal` | `#FF5B14` | The single accent: key buttons, highlights, big words on dark |
| `text-soft` | `#3A3F47` | Body copy on light backgrounds |
| `muted` | `#6B7079` | Inactive steps, hints |
| `on-dark` | `#C9CBC4` | Body copy on `ink` |
| `done` | `#1E8C4E` | Completed tick, success only |

Rules:
- `signal` is the only accent. Do not add blue, purple or teal.
- `signal` is never used as small text on `concrete` or `paper` (fails contrast). Use it as a fill with `ink` text, or as large text on `ink`.
- Error states use `ink` with a bold "!" marker and clear wording, not a new red. If a red is unavoidable, use `#B3261E` for errors only.
- No gradients, no glassmorphism, no blurred blobs.

## 3. Typography

Load from Google Fonts: Bricolage Grotesque (600, 800), DM Sans (400, 500, 700), DM Mono (500).

| Role | Font | Style |
|---|---|---|
| Headings, big numbers, logo | Bricolage Grotesque 800 | Tight: `letter-spacing: -0.03em`, `line-height: 0.92 to 1` |
| Body, forms, buttons | DM Sans 400/500/700 | `line-height: 1.5` |
| Labels, job numbers, ETA, status codes | DM Mono 500 | Uppercase, `letter-spacing: 0.06em`, 13px |

Scale (fluid with `clamp()`):
- Hero H1: `clamp(44px, 7.6vw, 112px)`
- Section H2: `clamp(36px, 5vw, 64px)`
- Card titles: 34 to 44px
- Body: 18px desktop, 17px mobile
- Form inputs: at least 16px (stops iOS zoom)

## 4. Shape and surface

- **Square corners.** No border radius on cards, buttons, inputs or chips. (Circles are only for tick marks, avatars and the countdown ring.)
- **Borders:** 2px solid `ink` on every card, button, chip and input.
- **Hard offset shadows:** `9px 9px 0 ink` (or `signal` on dark cards). Never soft blurred shadows.
- **Tilt:** tickets may rotate between -2.5deg and 2.5deg on landing and dashboards. Never tilt forms, tables or text-heavy screens.
- **Dividers:** `2px dashed ink` inside tickets (tear line), `2px solid ink` between list rows.
- **Ruler strip:** a 30px tape-measure band (repeating ink ticks every 12px, taller every 60px) between major sections.
- **Outline numerals:** big step numbers use transparent fill with a 2px `ink` text stroke.

## 5. Components

**Buttons**
- Primary: `signal` fill, `ink` text, 2px `ink` border, bold, optional `5px 5px 0 ink` shadow. Min height 44px.
- Secondary: transparent, 2px `ink` border.
- Dark: `ink` fill, `concrete` text.
- Text link: bold, underlined.
- Pressed state: shift 2px down and right and reduce the shadow.

**Ticket card** (`paper`, 2px border, hard shadow, header row in DM Mono: `CUSTOMER COPY` / `No. 0427`, big title, dashed divider, content). The partner version is `ink` background with `signal` shadow.

**Chips:** 2px border, square, DM Sans/Bricolage 26px. Used for service names and filters.

**Step rows:** outline numeral (52px) plus text, separated by a dashed line.

**Tick marks:** 22px circle in `done` with a white check (filled = completed), or a 2px `muted` outline circle (not yet reached). These are the six tracking steps.

**FAQ / accordions:** native `<details>` with 2px top borders. No chevron icons from libraries.

**Inputs:** `paper` background, 2px `ink` border, label above in DM Sans 700, error text below in bold with a "!" marker. Focus: 3px `signal` outline offset by 2px.

**Tables (admin):** 2px `ink` header border, DM Mono uppercase column headers, zebra rows using `concrete` and `paper`. On small screens each row becomes a stacked ticket card.

**Badges / status stamps:** small DM Mono uppercase label with a 2px border, slightly rotated (-3deg), like a rubber stamp. Examples: `VERIFIED`, `PENDING`, `REJECTED`, `OFFLINE`.

## 6. Key screens (extra direction)

**Tracking screen (customer):** the highlight of the product. A work-order ticket with the six steps (Request accepted, Partner on the way, Partner arrived, Service started, Service completed, Payment completed). Each step's tick "stamps" in (scale from 1.4 to 1 with a short settle) when it completes in real time. Above it, the custom SVG map: `ink` lines on `concrete`, partner as a `signal` square marker, customer as an `ink` circle, a dashed path between them, ETA in a DM Mono bar.

**Searching screen:** a pulsing ruler strip sweeping left to right with the text "Finding the nearest partner". Cancel button always visible. Failure state: stamp "ALL PARTNERS BUSY" with a "Try again later" message.

**Incoming request (partner):** a ticket popup with a countdown ring (stroke in `signal`) and large Accept and Decline buttons.

**Active job (partner):** one large primary button showing only the next action (Start trip, Arrived, Start service, Complete service, Payment received), plus the customer address and a small status ladder.

**Admin:** desktop-first, sidebar in `ink`, content on `concrete`. Charts use only `ink`, `signal` and `muted` (plus `done` for success). Direct labelling over legends where possible.

## 7. Icons and imagery

- Icons are small inline SVG, geometric, 2px stroke, square caps, in one consistent set (tools, bolt, droplet, hammer, snowflake, plug). No emoji, no icon-in-a-circle cards.
- No stock photos. Use simple SVG shapes, ruler strips and stamps for decoration.
- Service photos uploaded by customers are shown in a bordered square frame.

## 8. Motion

- Short and purposeful: 150 to 250ms.
- Allowed: tick stamp-in, button press, ticket slide-in, ruler sweep on searching, countdown ring.
- Not allowed: parallax, floating blobs, fade-up on every section.
- Respect `prefers-reduced-motion`: turn off all animation except status changes.

## 9. Copy voice

- Short, plain, local. "Tap, and a plumber is on the way", not "Seamless service experiences".
- Never use: seamless, empower, elevate, unlock, revolutionize, cutting-edge, "your all-in-one solution".
- No invented statistics or fake testimonials. Use clear placeholders such as `[PRICE]` until real data exists.
- Error and empty states say what happened and what to do next.

## 10. Responsive rules

Build **mobile first**, then enlarge. Test at 360, 390, 768, 1024 and 1440px.

| Breakpoint | Tailwind | Layout |
|---|---|---|
| Under 640px | base | Single column, full-width buttons, bottom navigation (customer and partner portals) |
| 640px and up | `sm` | Wrapping grids, larger type |
| 768px and up | `md` | Two-column layouts, tickets side by side |
| 1024px and up | `lg` | Sidebar navigation for portals, wider grids |
| 1280px and up | `xl` | Content capped at 1440px, centred |

- **Customer and partner portals:** phone-first app feel, bottom nav with 3 to 4 items on phones, left sidebar on `lg`.
- **Admin portal:** desktop-first with a collapsible sidebar; tables become stacked cards under `md`.
- Use fluid sizing: `clamp()`, `rem`, `%`, CSS Grid with `repeat(auto-fit, minmax(min(100%, 320px), 1fr))`.
- Touch targets at least 44px. No hover-only interactions.
- Set `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`, use `dvh` for full-height screens, and pad with `env(safe-area-inset-*)`.
- The SVG map uses a `viewBox` and scales to any width.
- Wide content (tables) scrolls inside its own container; the page never scrolls sideways.

## 11. Accessibility

- Real `<button>`, `<a>`, `<input>` with `<label>`. Never a clickable `div`.
- Text contrast at least 4.5:1 (3:1 for text 24px and larger).
- Status is never colour alone: pair `done` with a check and a label.
- Visible focus on every interactive element.
- `aria-label` on icon-only buttons; decorative SVG gets `aria-hidden="true"`.
- Live status updates on the tracking screen use `aria-live="polite"`.

## 12. Tailwind setup

```js
// tailwind.config.js (extend)
theme: {
  extend: {
    colors: {
      ink: '#111418', concrete: '#EDEEE9', paper: '#FBFAF6',
      signal: '#FF5B14', soft: '#3A3F47', muted: '#6B7079',
      'on-dark': '#C9CBC4', done: '#1E8C4E',
    },
    fontFamily: {
      display: ['"Bricolage Grotesque"', 'sans-serif'],
      sans: ['"DM Sans"', 'sans-serif'],
      mono: ['"DM Mono"', 'monospace'],
    },
    boxShadow: {
      hard: '9px 9px 0 #111418',
      'hard-sm': '5px 5px 0 #111418',
      'hard-signal': '9px 9px 0 #FF5B14',
    },
    borderRadius: { DEFAULT: '0', none: '0' },
  },
}
```

If using shadcn/ui, restyle every component to these tokens (square corners, 2px `ink` borders, hard shadows, these fonts) so nothing looks stock.

## 13. Never do this

- Purple or blue gradients, glassmorphism, blurred shadows, glowing effects
- A centred hero with a gradient headline and two pill buttons
- Rows of identical rounded cards with an icon on top, a title and two lines of text
- Inter, Roboto, Arial or system fonts
- Emoji used as icons
- Default Tailwind blue/indigo/purple
- Rounded pill buttons and fully rounded cards
- Lorem ipsum, fake stats, fake testimonials
- Mixing in a second UI library with its own style
