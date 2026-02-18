# Project Handoff

## Project

- Name: `viral-machine-mvp`
- Repo: `https://github.com/MagicWifiMoney/viral-machine-mvp`
- Production URL: `https://viral-machine-mvp.vercel.app`

## Current Status

- Deploy pipeline is healthy.
- DB initialization endpoint is healthy.
- Assets upload endpoint is healthy.
- Worker queue processing is healthy.
- A editpack output path is healthy.
- B MP4 integration is implemented and no longer hard-failing on request validation.
- Deep YouTube analysis is offloaded to a DigitalOcean worker service.

## Credentials / Env Setup

Configured in Vercel production:

- `POSTGRES_URL`
- `BLOB_READ_WRITE_TOKEN`
- `OPENAI_API_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `ADMIN_PASSWORD`
- `WORKER_BASE_URL`
- `WORKER_API_KEY`

Configured on DigitalOcean worker container:

- `OPENAI_API_KEY`
- `WORKER_API_KEY`

If rotating credentials:

1. Update Vercel env vars.
2. Redeploy production.
3. Test `/api/init-db` and one fresh batch.

## Operational Runbook

### 1. Initialize DB

- URL: `/api/init-db`
- Expected: `{"ok":true}`

### 2. Upload Minimum Assets

Go to `/assets` and ensure all required categories exist.

### 3. Queue Batch

Go to `/` and click `Generate 20 + Queue A10/B10`.

### 4. Force Workers (if needed)

- `/api/worker`
- `/api/render-worker`

### 5. Observe Outputs

- `/jobs/<id>`
- Expect:
  - `A editpack` links
  - `B mp4` links (eventually, depending on OpenAI processing latency)

### 6. Reference-Driven Generation (Recommended)

1. On `/`, paste a YouTube URL.
2. Click `Deep Analyze Video Style`.
3. Wait for success message.
4. Queue batch and run workers.

This stores a style profile that future batches use for hooks, pacing, and visual structure.

## Code Areas to Know

- `lib/openaiVideo.ts`
  - OpenAI video task create/poll/content resolution.
- `lib/workers.ts`
  - Main queue processor and A/B output writing.
- `lib/db.ts`
  - Schema setup and status transitions.
- `app/api/*`
  - Public operational API endpoints.
- `worker-service/*`
  - External deep-analysis service running on DigitalOcean.

## Known Risks / Watchpoints

- OpenAI job completion latency can vary.
- Cost control: worker polling frequency and batch volume.
- Rendering on Vercel serverless should remain optional for heavy video workloads.
- If worker IP changes, update `WORKER_BASE_URL` in Vercel and redeploy.
- If worker auth fails, rotate and sync `WORKER_API_KEY` in both Vercel and worker container.

## Suggested Immediate Improvements

1. Add structured logging for each job item state transition.
2. Add retry/backoff policy for transient OpenAI/API failures.
3. Add lightweight admin dashboard metrics:
   - queue depth
   - success/failure rate
   - average time-to-complete per mode
4. Add integration tests for queue + worker lifecycle.

## Ownership Notes

If handing to another engineer, first tasks should be:

1. Validate one end-to-end batch in production.
2. Confirm env var ownership and rotation policy.
3. Add alerting on worker failures and stalled jobs.

## Definition of "Healthy"

- `/api/init-db` returns `ok: true`
- New jobs move from `queued` -> `running` -> `completed`/`partial_failed`
- A outputs produce expected count
- B outputs eventually produce links without validation errors
