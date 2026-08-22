# Durable project memory

Keep this index below roughly 130 lines. Add an entry only when a future
session would be surprised and grateful to know it before starting. Do not
store secrets, personal data, temporary status, or facts that are obvious from
the code.

- [Production integrations](knowledge/integrations.md) — verify MongoDB,
  Cloudinary, Google, Gemini, and WhatsApp from their actual configured state;
  the UI alone is not proof.
- [Deployment constraints](knowledge/deployment.md) — Render environment
  variables are required for durable production data and integrations.
- [Architecture notes](knowledge/architecture.md) — public site and CRM share
  one Express server but have separate client entry points.
- Google Calendar OAuth depends on configured production variables and the
  registered callback URL; local JSON token storage is only a fallback and is
  not durable on Render.
- Google Analytics 4 is enabled only when Render has a valid
  `GOOGLE_ANALYTICS_MEASUREMENT_ID` (`G-...`). The public tag is loaded only
  after the visitor accepts optional cookies.
