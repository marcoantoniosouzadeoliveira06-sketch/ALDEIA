---
name: render-deployment
description: Render runs the Express server and requires external persistence for reliable production state.
metadata:
  type: architecture
---

`render.yaml` starts `server.js` and defines the expected production variables.
Fallback JSON files are helpful for local development, but they are not a
durable multi-instance production database. Treat a missing MongoDB or media
configuration as degraded service, validate it in Render, and do not infer a
successful deployment solely from a green process status.

Use Render's configured `PORT`, keep the health route lightweight, and verify
OAuth redirect URLs against the public Render URL after any domain change.
