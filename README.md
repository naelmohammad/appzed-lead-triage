# AppZed Lead Triage Agent

Clef-flash decision model classifies inbound leads (intent, urgency, spam) and logs them to D1. Schema self-initializes.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/naelmohammad/appzed-lead-triage)

Click **Deploy to Cloudflare**: it clones this repo to your GitHub account, provisions the bindings below on your Cloudflare account, and wires CI/CD with preview URLs on every PR.

## Bindings (auto-provisioned)

```jsonc
{
  "name": "appzed-lead-triage",
  "ai": {
    "binding": "AI"
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "appzed-lead-triage-leads"
    }
  ]
}
```

## Try it

```bash
curl -X POST https://<your-worker>.workers.dev/ingest -d '{"email":"a@b.com","message":"Need a demo"}'
```

GET /health for a liveness check. Managed by AppZed (https://dev.appzed.com/solutions/lead-triage).
