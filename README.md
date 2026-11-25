# BiletFlow_SRS_SWE_Team13
BiletFlow — Self-service event ticketing and digital pass verification platform tailored for Kazakhstan. Built for CSCI 361 (Fall 2026).

## Run locally

Requirements: Node.js 20+, PostgreSQL.

1. Create `.env` in the project root (see `backend_src/.env.example`):
   ```
   PORT=5000
   JWT_SECRET=<long random string>
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/biletflow_demo?schema=public
   ```
2. Install, create the schema and seed demo data:
   ```
   npm install
   npx prisma generate
   npx prisma migrate deploy
   npx prisma db seed
   ```
3. Start the API and the website in two terminals:
   ```
   npm start        # API  -> http://localhost:5000/api
   npm run dev      # Web  -> http://localhost:5173
   ```

Seeded accounts (password `Password123!`): `attendee@biletflow.kz`, `organizer@biletflow.kz`, `scanner1@biletflow.kz` (gate staff), `admin@biletflow.kz`.

Backend tests (no database needed): `node --test backend_src/tests/api.test.js`

## Demo journey

1. Attendee signs in → Events → Get tickets → Place Order → My Tickets shows the QR.
2. Gate staff signs in → Check-in → selects the event → enters the ticket code → **Admitted**.
3. Same code again → **Already checked in — entry rejected**; the checked-in counter does not change.
4. Organizer signs in → Organizer Dashboard shows sales, revenue and check-ins; Create Event publishes a new event.

Payments are simulated: orders complete immediately and no card is charged.
