---
name: application-architecture
description: Public site, CRM, and APIs share one Express server while keeping separate browser entry points.
metadata:
  type: architecture
---

`server.js` is the integration and persistence boundary for both the public
website and `admin.html`. The browser pages are mostly vanilla JavaScript, so a
change to an API response can affect multiple pages without a compile-time
contract. For cross-cutting changes, trace the route, its client callers, and
the relevant JSON/Mongo persistence path before editing.

The largest surfaces are `server.js` and `admin.html`; use symbol searches and
targeted ranges rather than loading either file wholesale.
