# Project map

## Purpose

ALDEIA combines a public agency website with a vanilla-JavaScript CRM/admin
panel. The server owns the public API, admin authentication, persistence, and
external integrations.

## Stack and entry points

| Area | Source of truth |
| --- | --- |
| Runtime | Node.js, CommonJS, Express |
| Server and API | `server.js` |
| Public site | `index.html`, `style.css`, `app.js` |
| Portfolio | `portfolio.html`, `portfolio.js`, `projeto.html`, `projeto.js` |
| CRM/admin | `admin.html` with inline CSS and JavaScript |
| Static media | `assets/` |
| Deployment | `render.yaml` on Render |

## Data and integrations

- MongoDB Atlas through Mongoose is the intended production database; JSON
  files are a fallback for local or degraded operation.
- Cloudinary handles production media uploads when configured.
- Google Calendar / Meet uses OAuth variables from the environment.
- Gemini and WhatsApp are optional integrations and must degrade safely when
  their credentials or service are unavailable.
- The admin uses authenticated bearer sessions; never treat UI visibility as
  authorization.

## Commands

```text
npm start            Start the server
npm run dev          Same local server entry point
npm run check        JavaScript syntax and inline-script checks
npm test             Alias for the existing check
npm run ai:status    Compact working-tree summary
npm run ai:diff      Compact diff summary; accepts paths after --
npm run ai:check     Compact wrapper around the existing check
```

## Working rules

- `admin.html` and `server.js` are high-impact files; inspect a symbol or
  targeted range before editing.
- Runtime JSON, environment files, caches, and uploads are not source code.
  Do not delete or commit them as part of normal feature work.
- The Render configuration lists required production environment variables but
  does not store their values. Confirm live integration state with an actual
  request or provider dashboard before claiming it works.
