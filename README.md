# Viral Machine MVP

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy env file and fill values:

```bash
cp .env.example .env.local
```

3. Run locally:

```bash
npm run dev
```

4. Initialize DB:
- Open `http://localhost:3000/api/init-db`

## Deploy

1. `vercel`
2. `vercel deploy --prod`
3. Open `https://YOUR-VERCEL-URL.vercel.app/api/init-db`
4. Set `NEXT_PUBLIC_SITE_URL` in Vercel environment variables
5. Redeploy
