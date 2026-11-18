This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
<<<<<<< HEAD

---

## Configuration

Copy `.env.example` to `.env.local` and fill in the values. `.env*` files are git-ignored (only `.env.example` is tracked). Never put secrets in `NEXT_PUBLIC_*` variables.

```bash
npm install
cp .env.example .env.local        # then edit
openssl rand -base64 32           # paste into ENCRYPTION_KEY
supabase db push                  # applies supabase/migrations (adds user_tokens / history hardening)
npm run dev
```

### Microsoft Teams (optional)

Set one server-side variable (the URL is a secret and is never sent to the browser):

```
TEAMS_WEBHOOK_URL=<Teams Workflows webhook URL>
```

1. In Teams, open the target channel → **•••** → **Workflows**.
2. Choose **"Post to a channel when a webhook request is received"**, name it, pick the team/channel.
3. Copy the generated URL into `TEAMS_WEBHOOK_URL` and restart the server.
4. Open **Settings → Microsoft Teams** — it should read **Configured** — and click **Send test message**.

The legacy Office 365 "Incoming Webhook" connectors were retired by Microsoft in 2026; only Workflows webhooks are supported.
If Teams is unset or fails, Slack/Discord/Jira/Trello are unaffected.

### Code Reviewer scopes

`POST /api/code-review` accepts `scope`: `commits` (default, original behaviour), `file`, `selection`, `lines`, `repo`.
See `lib/review-input.ts` for the exact parameters of each scope.

### Security notes

All `/api/*` routes require `Authorization: Bearer <Supabase access token>`; the user id always comes from the verified token.
Cross-origin API access is denied unless the origin is listed in `ALLOWED_ORIGINS`.
Rate limiting is in-memory (per server instance); use a shared store such as Redis/Upstash for strict global limits.
=======
>>>>>>> origin/main
