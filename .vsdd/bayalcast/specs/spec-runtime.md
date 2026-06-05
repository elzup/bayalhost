---
id: spec:runtime
title: low-load static runtime
coherence:
  depends_on:
    - design:config
    - spec:setup
---

# spec:runtime

## Requirements

- REQ-RUNTIME-001: THE SYSTEM SHALL default to native Caddy for low-load static
  serving.
- REQ-RUNTIME-002: WHERE middleware or isolation requirements become meaningful,
  THE SYSTEM SHALL allow Docker as a runtime option.
- REQ-RUNTIME-003: THE SYSTEM SHALL route `https://<project>.bayalhost` to
  `sites/<project>/current`.
- REQ-RUNTIME-004: THE SYSTEM SHALL support runtime browser config through an
  optional generated `/env.js`.
