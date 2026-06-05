---
id: spec:admin-ui
title: admin.bayalhost management UI
coherence:
  depends_on:
    - design:config
    - spec:registry-cli
    - spec:scan
    - spec:runtime
---

# spec:admin-ui

## Requirements

- REQ-ADMIN-001: THE SYSTEM SHALL reserve `admin.bayalhost` for project
  registration and deployment management.
- REQ-ADMIN-002: WHEN the admin UI loads, THE SYSTEM SHALL show registered
  projects with their `<project>.bayalhost` URLs.
- REQ-ADMIN-003: WHEN the admin UI scans candidates, THE SYSTEM SHALL show
  candidate `out`, `dist`, and `build` artifact directories.
- REQ-ADMIN-004: WHEN the user saves a candidate, THE SYSTEM SHALL add or update
  the JSON registry.
- REQ-ADMIN-005: WHEN the user deploys a registered project, THE SYSTEM SHALL
  run the same deploy path as the CLI.
