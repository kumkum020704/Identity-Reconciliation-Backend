# Bitespeed Identity Reconciliation

A web service that identifies and links customer contacts across multiple purchases using different email addresses and phone numbers.

## Live Endpoint

>Here is the URL with endpoint
```
POST https://https://identity-reconciliation-backend-c1nt.onrender.com/identify
```

---

## Local Setup

### Prerequisites
- Node.js 20+
- PostgreSQL (local or cloud)

### 1. Clone & Install
```bash
git clone https://github.com/your-username/bitespeed-identity
cd bitespeed-identity
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env and set your DATABASE_URL
```

`.env` format:
```
DATABASE_URL="postgresql://user:password@localhost:5432/bitespeed_db"
PORT=3000
```

### 3. Run Database Migrations
```bash
npx prisma migrate dev --name init
```

### 4. Start Dev Server
```bash
npm run dev
```

### 5. Build for Production
```bash
npm run build
npm start
```

---

## API

### POST /identify

Identifies a customer by email and/or phone number. Creates or links contacts as needed.

**Request Body** (JSON):
```json
{
  "email": "lorraine@hillvalley.edu",
  "phoneNumber": "123456"
}
```
At least one of `email` or `phoneNumber` must be provided.

**Response (200)**:
```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["lorraine@hillvalley.edu", "mcfly@hillvalley.edu"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": [23]
  }
}
```

**Error (400)** — when both fields are null/missing:
```json
{
  "error": "At least one of 'email' or 'phoneNumber' must be provided."
}
```

## Testing with Postman

Import `postman_collection.json` into Postman. Set the `baseUrl` variable to your local or deployed URL.

The collection covers:
- New contact creation
- Exact match (no new row)
- Secondary contact creation (new info, matching existing)
- Lookup by email only / phone only
- Two separate primaries getting merged (older stays primary)
- Error cases (both null, empty body)

---

## Project Structure

```
├── prisma/schema.prisma        # Database schema
├── src/
│   ├── index.ts                # Express app + server
│   ├── lib/prisma.ts           # Prisma client singleton
│   ├── routes/identify.ts      # POST /identify handler
│   └── services/contactService.ts  # Core reconciliation logic
├── ARCHITECTURE.md             # Design doc + algorithm
├── postman_collection.json     # Postman test suite
└── .env.example
```
