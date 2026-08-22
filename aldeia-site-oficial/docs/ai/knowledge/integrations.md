---
name: production-integrations
description: External services are optional locally but require environment configuration and live verification in production.
metadata:
  type: reference
---

The server can run without several production integrations, but a fallback UI
does not prove the integration is available. Before diagnosing or promising a
production capability, verify the relevant environment variables and a real
provider/API response:

- MongoDB: `MONGODB_URI`
- Cloudinary: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`,
  `CLOUDINARY_API_SECRET`
- Google Calendar/Meet: OAuth client variables, redirect URI, token encryption
  key, and authorized redirect URL
- Gemini: `GEMINI_API_KEY`
- Email sharing: Resend and sender/admin mail variables
- WhatsApp: it is intentionally optional and must not be reported as connected
  unless its service has actually initialized.

Never write values for these variables into docs, Git, browser code, or AI
memory.
