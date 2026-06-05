# bayalhost

Host local static builds between `nr dev` and production.

This repo is a lightweight static preview host for multiple projects. Each app is
served from a built `dist` directory on the host PC, without deploying to a
remote production environment.

## URL Model

Use wildcard DNS for the host PC:

```text
*.bayalhost -> <host-pc-ip>
```

Each project is served by subdomain:

```text
https://<project>.bayalhost
```

Examples:

```text
https://foo.bayalhost
https://admin.bayalhost
https://landing.bayalhost
```

## Directory Layout

```text
bayalhost.config.json
sites/
  <project>/
    current -> releases/<timestamp>
    releases/
      <timestamp>/
        index.html
        assets/
        env.js
```

`current` is switched atomically after a new `dist` copy is complete.

## Project Registry

Projects are registered in `bayalhost.config.json`.

```json
{
  "name": "comemiru",
  "source": "/Users/hiro/.ghq/github.com/elzup/comemiru",
  "artifact": "/Users/hiro/.ghq/github.com/elzup/comemiru/out",
  "envFile": "",
  "type": "static",
  "enabled": true
}
```

The schema is [schemas/bayalhost.schema.json](schemas/bayalhost.schema.json).

## CLI

List registered projects:

```bash
./scripts/bayalhost.mjs list
```

Scan candidates under configured `scanRoots`:

```bash
./scripts/bayalhost.mjs scan
```

Add or update a project:

```bash
./scripts/bayalhost.mjs add comemiru /Users/hiro/.ghq/github.com/elzup/comemiru/out \
  --source /Users/hiro/.ghq/github.com/elzup/comemiru
```

Deploy from the registry:

```bash
./scripts/bayalhost.mjs deploy comemiru
```

Validate registered projects:

```bash
./scripts/bayalhost.mjs validate
```

## Deploy A Static Build

From this repo:

```bash
./scripts/deploy-dist.sh <project> /path/to/project/dist
```

For example, a Next static export such as `elzup/comemiru/out`:

```bash
./scripts/deploy-dist.sh comemiru /Users/hiro/.ghq/github.com/elzup/comemiru/out
```

That serves:

```text
https://comemiru.bayalhost
```

With runtime environment variables:

```bash
./scripts/deploy-dist.sh <project> /path/to/project/dist /path/to/project/.env.bayalhost
```

The optional env file is rendered to:

```text
sites/<project>/current/env.js
```

The generated browser global is:

```js
window.__BAYALHOST_ENV__
```

In the app, include `/env.js` before the bundled app script when runtime config
is needed.

## Caddy

Install Caddy, then run from this repo:

```bash
caddy run --config Caddyfile
```

For a permanent service, point your launchd/systemd service at this repository
and run the same Caddyfile. Caddy is a good fit here because it is a single low
load process and can serve all projects through one wildcard host rule.

## Native Or Docker

Default to native Caddy for this use case:

- Static file serving is very low load.
- One native Caddy process can serve all projects.
- No per-project containers are needed for plain `out/` or `dist/` hosting.

Use Docker only when the middleware becomes meaningful:

- The host needs extra services beyond static files.
- A project requires process isolation.
- Reproducible runtime packaging matters more than idle resource usage.

macOS launchd template:

```bash
cp launchd/com.elzup.bayalhost.plist ~/Library/LaunchAgents/
launchctl bootstrap "gui/$(id -u)" ~/Library/LaunchAgents/com.elzup.bayalhost.plist
launchctl enable "gui/$(id -u)/com.elzup.bayalhost"
```

Logs:

```text
/tmp/bayalhost-caddy.out.log
/tmp/bayalhost-caddy.err.log
```

## Environment Variables

Static sites cannot read server process environment variables after build. Use
one of these patterns:

- Build-time env: set env vars before `nr build`; simplest, but every change
  requires rebuilding.
- Runtime env: pass an env file to `deploy-dist.sh`; it generates `env.js`, and
  changing env only requires re-running deploy.

Env file format:

```dotenv
API_BASE_URL=https://api.example.com
FEATURE_X=true
```

Lines beginning with `#` are ignored. Values are emitted as strings.

## Notes

- Project names must match `[a-z0-9-]+`.
- The Caddyfile uses `tls internal`, so clients may need to trust Caddy's local
  CA for clean HTTPS.
- If you do not want local HTTPS, remove `tls internal` and use HTTP-only
  addresses while testing.
