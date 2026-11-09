# expense-claims

The expense claims app. Employees log in, create a claim for money they spent and attach the receipts. The finance team opens any claim and checks its receipts. The backend is an Express API over MySQL, the frontend a React page. Receipts are stored inside the database today.

## Stack

| Part | Technology | Local address |
|---|---|---|
| Frontend | React 19, Vite 8 | http://localhost:5173 |
| API | Node.js 22, Express 5 | http://localhost:4000 |
| Database | MySQL 8.4, Sequelize 6 with sequelize-cli migrations | `localhost:3310` |
| Object storage | MinIO, an S3-compatible object store | S3 API on http://localhost:9000, console on http://localhost:9001 |

Docker Compose runs MySQL and MinIO. The API and the frontend run on your machine. In development, Vite forwards every `/api` request to the API. MinIO is an object storage server that speaks the Amazon S3 API; Docker Compose creates one bucket, `receipts`, on first start. The application does not use MinIO today.

## Run it

API, from `backend/`:

```bash
cd backend
cp .env.example .env
docker compose up -d
npm install
npm run db:migrate
npm run db:seed
npm start
```

Frontend, in a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 and log in with one of the seeded accounts. The password is `password123` for all of them.

| Account | Role | Sees |
|---|---|---|
| `anna@example.com` | employee | Her own 12 claims |
| `ben@example.com` | employee | His own 12 claims |
| `clara@example.com` | finance | All claims |

The MinIO console is at http://localhost:9001; log in with `S3_ACCESS_KEY` and `S3_SECRET_KEY` from `.env`. In `backend/`, `npm run dev` restarts the API on file changes and `npm run db:reset` drops, migrates and reseeds. In `frontend/`, `npm run build` followed by `npm run preview` serves the production build on http://localhost:4173.

If port 3310, 9000 or 9001 is taken on your machine, change `DB_PORT`, `MINIO_PORT` or `MINIO_CONSOLE_PORT` in `backend/.env` before `docker compose up`.

## How the app works

- Users log in with email and password. The API returns a JWT, valid for 12 hours, which the page sends as a bearer token with every request.
- Employees see their own claims, finance sees every claim. Anyone can create a claim.
- A claim page lists its receipts: file name, type, size, who uploaded it and when. The owner of the claim uploads receipts there. Finance only views.
- An upload sends the file to the API, which stores the bytes in the `data` column of the `receipts` table, next to the file name, type and size.
- Opening a receipt downloads it through the API and shows it on the page: images inline, PDFs in the browser's viewer.
- A receipt can be opened by the employee who owns the claim and by finance. Nobody else.

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Database connectivity check |
| POST | `/api/auth/login` | JSON body with `email` and `password`. Returns `token` and `user` |
| GET | `/api/claims` | The caller's claims, or all claims for finance, newest first, each with its `receiptCount` |
| POST | `/api/claims` | Create a claim. JSON body with `title`, `amountCents` and `spentOn` as `YYYY-MM-DD` |
| GET | `/api/claims/:id` | One claim with its receipts, metadata only |
| POST | `/api/claims/:id/receipts` | Upload a receipt: multipart form with the file in the `file` field. Owner of the claim only |
| GET | `/api/receipts/:id/download` | The file itself, with `Content-Type` and `Content-Disposition` headers |

Every `/api` route except login needs an `Authorization: Bearer <token>` header.

```bash
curl -X POST http://localhost:4000/api/auth/login -H 'Content-Type: application/json' \
     -d '{"email": "anna@example.com", "password": "password123"}'
```
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": { "id": 1, "name": "Anna Adams", "email": "anna@example.com", "role": "employee" }
}
```

```bash
curl http://localhost:4000/api/claims/23 -H "Authorization: Bearer $TOKEN"
```
```json
{
  "id": 23,
  "userId": 1,
  "title": "Hotel, two nights",
  "amountCents": 35782,
  "spentOn": "2026-11-02",
  "createdAt": "2026-11-05T11:00:00.000Z",
  "employee": { "id": 1, "name": "Anna Adams" },
  "receipts": [
    {
      "id": 34,
      "claimId": 23,
      "uploadedBy": 1,
      "fileName": "receipt-2026-11-02-900.pdf",
      "contentType": "application/pdf",
      "sizeBytes": 1404,
      "createdAt": "2026-11-05T11:00:04.000Z",
      "uploader": { "id": 1, "name": "Anna Adams" }
    },
    {
      "id": 35,
      "claimId": 23,
      "uploadedBy": 1,
      "fileName": "receipt-2026-11-02-297.pdf",
      "contentType": "application/pdf",
      "sizeBytes": 1276,
      "createdAt": "2026-11-05T11:01:17.000Z",
      "uploader": { "id": 1, "name": "Anna Adams" }
    },
    {
      "id": 36,
      "claimId": 23,
      "uploadedBy": 1,
      "fileName": "IMG_5060.png",
      "contentType": "image/png",
      "sizeBytes": 6132474,
      "createdAt": "2026-11-05T11:02:29.000Z",
      "uploader": { "id": 1, "name": "Anna Adams" }
    }
  ]
}
```

```bash
curl -X POST http://localhost:4000/api/claims/23/receipts -H "Authorization: Bearer $TOKEN" -F 'file=@receipt.pdf'
```
```json
{
  "id": 40,
  "claimId": 23,
  "uploadedBy": 1,
  "fileName": "receipt.pdf",
  "contentType": "application/pdf",
  "sizeBytes": 1210,
  "createdAt": "2026-11-09T15:08:37.000Z",
  "uploader": { "id": 1, "name": "Anna Adams" }
}
```

```bash
curl -D - -o IMG_5060.png http://localhost:4000/api/receipts/36/download -H "Authorization: Bearer $TOKEN"
```
```
HTTP/1.1 200 OK
Content-Type: image/png
Content-Disposition: inline; filename="IMG_5060.png"; filename*=UTF-8''IMG_5060.png
Content-Length: 6132474
```

Errors come back as JSON, `{"error": "...", "details": [...]}`, with status 400, 401, 403 or 404. For example `{"error": "Missing bearer token"}`, `{"error": "You cannot view this claim"}` or `{"error": "A file is required in the \"file\" field"}`.

## Scripts

Run them from `backend/`.

| Command | What it does |
|---|---|
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Insert test data: 3 users, `SEED_CLAIMS` claims, 24 by default, and about 1.6 receipts per claim. The receipts are generated files: photos as PNG, 3 to 6 MB each, and PDF e-receipts of about 1 KB. The data is the same on every run. Refuses on a non-empty table. Takes about 8 seconds |
| `npm run db:reset` | Drop all tables, migrate and seed again |
| `SEED_CLAIMS=240 npm run db:reset` | Ten times the data: 240 claims, 335 receipts, 945 MB. Takes about a minute |

## Environment variables

In `backend/.env`:

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `4000` | HTTP port of the API |
| `JWT_SECRET` | see `.env.example` | Signs the login tokens |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | see `.env.example` | MySQL connection. Docker Compose reads the same values |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` | see `.env.example` | MinIO address, bucket and credentials. Docker Compose uses the key and the secret as MinIO's root user and creates the bucket. The application does not read them yet |
| `MINIO_PORT`, `MINIO_CONSOLE_PORT` | `9000`, `9001` | Host ports of the MinIO S3 API and console |
| `SEED_CLAIMS` | `24` | How many claims `db:seed` creates |
| `SQL_LOG` | `0` | `1` prints every SQL query |

## Known issues

In production:

- About 2,100 claims with 3,400 receipts so far, 11 GB of files, growing by about 300 receipts and 1 GB a month.
- Receipts are photos from phones, 3 to 6 MB each, and PDF e-receipts of a few kilobytes. The largest files are multi-page scans of 20 to 40 MB.
- Finance opens a few hundred receipts a day. Employees rarely open their own. Receipts have to be kept for seven years.
- The API runs in two containers behind a load balancer. Their disks are wiped on every deploy.

What happens today:

- The receipts table is 98% of the database. The nightly backup is 11 GB, almost all of it receipts, and takes about an hour. The last restore test took two hours. The database disk had to be enlarged twice this year.
- Every receipt that finance opens travels from MySQL through the API to the browser, and the API holds each file in memory while it is being sent.
- Scans of 64 MB and more fail with a database error, which the page shows as "Internal server error".
- Any file is accepted. Nothing checks the type or the size before it goes into the database.

Measured on a developer machine:

| | Default seed, 39 receipts | Ten times the data, 335 receipts |
|---|---|---|
| Receipt files | 140 MB | 945 MB |
| Database on disk | 145 MB | 961 MB |
| Full backup with `mysqldump` | 178 MB in 1.7 s | 1.2 GB in 10.8 s |
| Backup of everything except the file contents | 6 KB in 0.05 s | 20 KB in 0.05 s |

Ten people opening a 5.9 MB receipt at the same time raise the API's memory from 92 MB to 161 MB.

## Your task

Move the receipts out of the database into object storage. New uploads go to MinIO, and the receipts that exist today are moved there too. You may change the API, the frontend and the database.

Requirements:

1. Implement a file upload flow from the frontend.
2. Store uploaded files in an object storage service.
3. Save relevant file metadata in the application's database.
4. Associate uploaded files with the appropriate user or resource.
5. Implement a way to retrieve or download files.
6. Handle invalid files, upload failures, and unauthorized access.
7. Document the storage configuration and required environment variables.

Expected outcome:

- New receipts are stored in the `receipts` bucket, with their metadata in the database.
- The 39 receipts that exist today are moved to the bucket and still open. After the move, the database holds no file contents.
- Everything the team can do today still works: upload a receipt to your own claim, open every receipt you are allowed to see, and nobody else's.
- An invalid file or a failed upload ends with a clear error, not with a broken receipt.

How we work:

- Research freely: official documentation first, anything else that helps. Keep a note of what you relied on.
- When blocked, ask a focused question and include what you already tried.
- Commit in small steps so the path you took is visible.
- At the end we review the implementation together. Be ready to walk through the code, explain the trade-offs you made, and name what you would do differently with more time.
