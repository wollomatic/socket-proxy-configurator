# AGENTS.md

## Project

Static Svelte 5 web application that converts environment-style configuration
from either:

- Tecnativa/docker-socket-proxy
- linuxserver/docker-socket-proxy

to regexp allowlists for wollomatic/socket-proxy 1.12.0 or newer.

The application is fully static and must not require a backend or external API.

The main goal is a transparent and auditable conversion while keeping the
default output narrower than the source HAProxy prefix ACLs. Users can
explicitly include the broader source-proxy permissions.

---

## Tech Stack

- Svelte 5 with TypeScript
- Vite
- Static SPA only
- No SSR, backend, external APIs, telemetry, or persistence

Use modern Svelte 5 rune syntax where useful:

- `$state`
- `$derived`
- `$effect`

---

## UI Contract

The application uses a two-panel input/output layout.

The input panel accepts:

- environment variables
- line-based Docker Compose environment snippets
- plain pasted env files

The frontend must provide an explicit source selector:

- Tecnativa
- LinuxServer

Tecnativa is the default. Do not automatically infer the source profile.

The output panel supports:

- raw command arguments
- environment variables
- Docker labels

The existing network-listener compatibility option remains independent of the
broader source-proxy permissions option.

The frontend must provide an **Include Podman-specific endpoints** option:

- enabled by default
- active only for the LinuxServer source profile
- visible but disabled for Tecnativa
- when disabled, omit all `LIBPOD_*` paths from the target and warn about
  enabled Libpod source settings that were not converted

---

## Source Profiles

### Tecnativa

- `EVENTS`, `PING`, and `VERSION` default to enabled.
- Other API toggles and `POST` default to disabled.
- The global `POST` gate applies before all section and container-action rules.
- Consequently, `ALLOW_START`, `ALLOW_STOP`, `ALLOW_RESTARTS`,
  `ALLOW_PAUSE`, and `ALLOW_UNPAUSE` do not bypass `POST=0`.

### LinuxServer

- Supports the Docker-compatible toggles and their defaults.
- Additionally supports all `LIBPOD_*` toggles listed below.
- `LIBPOD_PING` and `LIBPOD_VERSION` default to enabled.
- Native `/libpod/...` target rules can be omitted with the Podman endpoint
  option without changing Docker-compatible LinuxServer rules.
- Docker container actions and Libpod container/pod actions are evaluated
  before the global `POST` gate and therefore work when `POST=0`.

---

## Method Policy

wollomatic/socket-proxy supports:

- GET
- HEAD
- POST
- PUT
- PATCH
- DELETE
- CONNECT
- TRACE
- OPTIONS

### Default mode

- Generate GET and HEAD for enabled paths.
- When the selected source permits writes, generate POST, PUT, and DELETE.
- Do not generate PATCH, OPTIONS, CONNECT, or TRACE.
- This reduced method selection is the default.

### Broader source-proxy permissions

- Generate every wollomatic-supported write method where the selected source
  proxy permits writes.
- For Tecnativa, all write rules still require `POST=1`.
- For LinuxServer, enabled Docker and Libpod action rules receive write methods
  even with `POST=0`; ordinary sections still require `POST=1`.

Use one option for both the extended method set and the extended regex behavior.
Do not introduce separate switches unless product requirements change.

---

## Regex Policy

wollomatic/socket-proxy automatically prepends `^` and appends `$`. Never emit
these anchors in the UI output.

API version prefixes are optional:

```text
(/v[\d.]+)?
```

### Default mode

Generate case-sensitive, valid-looking path shapes:

- Singleton paths such as `_ping` and `version` are exact.
- Container and pod action paths are exact.
- Section paths use a segment boundary, for example:

```text
(/v[\d.]+)?/containers(/.*)?
```

This allows `/containers` and `/containers/{id}` but not
`/containers-invalid`.

Do not maintain an exhaustive, version-dependent Docker or Podman route table.
The distinction between exact/action paths and segment-bounded sections is
intentional and keeps the implementation simple.

### Broader source-proxy permissions

Mirror HAProxy's case-insensitive prefix ACLs with scoped Go regexp flags and a
suffix wildcard:

```text
(?i:(/v[\d.]+)?/containers.*)
(?i:(/v[\d.]+)?/_ping.*)
```

This mode intentionally permits the same broad prefixes as the source proxy,
including paths that the Docker or Podman daemon may subsequently reject.

---

## Docker API Mappings

| Variable | Path |
|---|---|
| EVENTS | events |
| VERSION | version |
| PING | _ping |
| CONTAINERS | containers |
| IMAGES | images |
| NETWORKS | networks |
| SERVICES | services |
| TASKS | tasks |
| VOLUMES | volumes |
| EXEC | exec |
| INFO | info |
| SYSTEM | system |
| NODES | nodes |
| SWARM | swarm |
| SECRETS | secrets |
| CONFIGS | configs |
| DISTRIBUTION | distribution |
| SESSION | session |
| PLUGINS | plugins |
| GRPC | grpc |
| BUILD | build |
| COMMIT | commit |
| AUTH | auth |
| ALLOW_START | containers/{id}/start |
| ALLOW_STOP | containers/{id}/stop |
| ALLOW_RESTARTS | containers/{id}/stop, restart, kill |
| ALLOW_PAUSE | containers/{id}/pause |
| ALLOW_UNPAUSE | containers/{id}/unpause |

Special action IDs use the same character class as the source ACL:

```text
[a-zA-Z0-9_.-]+
```

---

## LinuxServer Libpod Mappings

| Variable | Path |
|---|---|
| LIBPOD_ALLOW_START | libpod/containers/{id}/start |
| LIBPOD_ALLOW_STOP | libpod/containers/{id}/stop |
| LIBPOD_ALLOW_RESTARTS | libpod/containers/{id}/stop, restart, kill |
| LIBPOD_ALLOW_PAUSE | libpod/containers/{id}/pause |
| LIBPOD_ALLOW_UNPAUSE | libpod/containers/{id}/unpause |
| LIBPOD_ALLOW_POD_START | libpod/pods/{name}/start |
| LIBPOD_ALLOW_POD_STOP | libpod/pods/{name}/stop |
| LIBPOD_ALLOW_POD_RESTARTS | libpod/pods/{name}/stop, restart, kill |
| LIBPOD_ALLOW_POD_PAUSE | libpod/pods/{name}/pause |
| LIBPOD_ALLOW_POD_UNPAUSE | libpod/pods/{name}/unpause |
| LIBPOD_CONTAINERS | libpod/containers |
| LIBPOD_EVENTS | libpod/events |
| LIBPOD_EXEC | libpod/exec |
| LIBPOD_GENERATE | libpod/generate |
| LIBPOD_IMAGES | libpod/images |
| LIBPOD_INFO | libpod/info |
| LIBPOD_MANIFESTS | libpod/manifests |
| LIBPOD_NETWORKS | libpod/networks |
| LIBPOD_PING | libpod/_ping |
| LIBPOD_PLAY | libpod/play |
| LIBPOD_PODS | libpod/pods |
| LIBPOD_SECRETS | libpod/secrets |
| LIBPOD_SYSTEM | libpod/system |
| LIBPOD_VERSION | libpod/version |
| LIBPOD_VOLUMES | libpod/volumes |

---

## Parsing Rules

The line-based parser must:

- ignore comments and empty lines
- support quoted values and `export` prefixes
- support common Compose list and mapping environment syntax
- tolerate whitespace
- normalize keys and boolean values case-insensitively
- warn on invalid booleans and treat them as disabled
- use source defaults only when a variable is absent, not when it is empty
- warn for unknown env-style variables
- avoid warnings for ordinary Compose structural keys
- use the last value for duplicate variables and warn about the duplicate

Accepted truthy values are:

- `1`
- `true`
- `yes`
- `on`
- `enable`
- `enabled`

Accepted falsy values are:

- `0`
- `false`
- `no`
- `off`
- `disable`
- `disabled`

These extended values are an intentional convenience feature even where source
documentation only demonstrates `0` and `1`.

Known settings:

- Convert `SOCKET_PATH` to `socketpath`.
- Map HAProxy log levels to DEBUG, INFO, WARN, or ERROR and warn when the
  mapping is approximate.
- Recognize `DISABLE_IPV6`, `BIND_CONFIG`, and LinuxServer `TZ`; emit targeted
  warnings when they cannot be reproduced cleanly.

The parser is intentionally not a complete YAML parser.

---

## Output Rules

### ENV

Emit unquoted dotenv-style entries:

```env
SP_ALLOW_GET=(/v[\d.]+)?/_ping
SP_ALLOW_GET_2=(/v[\d.]+)?/events(/.*)?
```

### Command

Emit one raw argument per line, without Compose list markers:

```text
-allowGET=(/v[\d.]+)?/_ping
-allowGET=(/v[\d.]+)?/events(/.*)?
```

### Labels

Emit a Compose-compatible `labels:` block using numbered label suffixes for
additional rules. Remind users that `SP_PROXYCONTAINERNAME` or
`-proxycontainername` is required.

---

## Traefik Compatibility

When `PING` is enabled, always generate both GET and HEAD access for `/_ping`
and its optional version-prefixed form. Modern Traefik requires `HEAD /_ping`.

---

## UX Goals

The application should remain:

- fast
- simple
- transparent
- auditable
- copy-paste friendly
- accessible by keyboard

Primary users are Docker/Podman administrators, DevOps engineers, homelab
users, Traefik users, and security-conscious operators.

---

## Non-Goals

- full HAProxy parsing
- automatic source-profile detection
- exhaustive or versioned Docker/Podman endpoint tables
- reverse conversion
- YAML AST editing
- backend persistence
- user accounts
