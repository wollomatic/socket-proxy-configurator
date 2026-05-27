# AGENTS.md

## Project

Static Svelte 5 web application to convert configurations from:

- docker-socket-proxy
to
- wollomatic/socket-proxy

The application is fully static and must not require any backend.

The main goal is to emulate the behaviour of docker-socket-proxy as closely as possible by generating compatible regexp allowlists for wollomatic/socket-proxy.

---

## Tech Stack

- Svelte 5
- Vite
- TypeScript
- Static SPA only
- No backend
- No server-side rendering required
- No external APIs

---

## UI Concept

Two-panel layout:

### Left panel
Input area for docker-socket-proxy configuration.

Supported input:
- Environment variables
- docker-compose snippets
- plain pasted env files

Example:

```env
CONTAINERS=1
EVENTS=1
POST=0
IMAGES=1
PING=1
VERSION=1
```

### Right panel
Generated wollomatic/socket-proxy configuration.

Selectable output modes:
- Environment variables
- Command-line arguments

Example ENV output:

```env
SP_ALLOW_GET=(/v[\d.]+)?/_ping
SP_ALLOW_GET_2=(/v[\d.]+)?/events.*
SP_ALLOW_GET_3=(/v[\d.]+)?/version
SP_ALLOW_GET_4=(/v[\d.]+)?/containers.*
SP_ALLOW_GET_5=(/v[\d.]+)?/images.*
SP_ALLOW_HEAD=(/v[\d.]+)?/_ping
SP_ALLOW_HEAD_2=(/v[\d.]+)?/events.*
SP_ALLOW_HEAD_3=(/v[\d.]+)?/version
SP_ALLOW_HEAD_4=(/v[\d.]+)?/containers.*
SP_ALLOW_HEAD_5=(/v[\d.]+)?/images.*
```

Example command output:

```text
-allowGET=(/v[\d.]+)?/_ping
-allowGET=(/v[\d.]+)?/events.*
-allowGET=(/v[\d.]+)?/version
-allowGET=(/v[\d.]+)?/containers.*
-allowGET=(/v[\d.]+)?/images.*
-allowHEAD=(/v[\d.]+)?/_ping
-allowHEAD=(/v[\d.]+)?/events.*
-allowHEAD=(/v[\d.]+)?/version
-allowHEAD=(/v[\d.]+)?/containers.*
-allowHEAD=(/v[\d.]+)?/images.*
```

---

## Behaviour Goals

The generated wollomatic/socket-proxy configuration should emulate docker-socket-proxy as closely as possible.

This means:

- disabled docker-socket-proxy sections must not be reachable
- enabled sections must be reachable
- readonly mode via POST=0 must be preserved
- HEAD requests must be allowed where docker-socket-proxy allows them
- API version prefixes must be handled correctly

---

## Important Architectural Differences

### docker-socket-proxy

Uses:
- HAProxy
- section-based allow/reject logic
- environment variable toggles

Example:
- CONTAINERS=1
- IMAGES=0

### wollomatic/socket-proxy

Uses:
- Go regexp allowlists
- per-HTTP-method allowlists
- explicit request path regexes

Example:
- SP_ALLOW_GET
- SP_ALLOW_POST
- SP_ALLOW_DELETE

The converter therefore needs to translate:
- logical API sections
into
- concrete HTTP method regex allowlists

---

## Important Behaviour Details

### Regex Handling

wollomatic/socket-proxy automatically prepends/appends:

- ^
- $

to regexes internally.

The UI should therefore NOT add those manually.

Example:

Correct:
```text
/v1\..{1,2}/containers/.*
```

Wrong:
```text
^/v1\..{1,2}/containers/.*$
```

---

## Supported Methods

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

Only the required methods should be generated.

---

## POST Behaviour

docker-socket-proxy uses:

```env
POST=0
```

to disable write operations globally.

Converter behaviour:

### POST=0

Generate only:
- GET
- HEAD

### POST=1

Additionally generate:
- POST
- PUT
- PATCH
- DELETE
- OPTIONS
- CONNECT
- TRACE

depending on the enabled API sections.

This is intentionally broad because docker-socket-proxy first gates unsafe methods with
`POST`, then gates only by path section. For high compatibility, enabled
sections should be reachable with every HTTP method that wollomatic supports.

---

## Required API Mappings

The following mappings should exist.

These mappings are intentionally approximate and compatibility-focused.

| docker-socket-proxy Variable | Docker API Paths                                                    |
|------------------------------|---------------------------------------------------------------------|
| EVENTS                       | events                                                              |
| VERSION                      | version                                                             |
| PING                         | _ping                                                               |
| CONTAINERS                   | containers                                                          |
| IMAGES                       | images                                                              |
| NETWORKS                     | networks                                                            |
| SERVICES                     | services                                                            |
| TASKS                        | tasks                                                               |
| VOLUMES                      | volumes                                                             |
| EXEC                         | exec                                                                |
| INFO                         | info                                                                |
| SYSTEM                       | system                                                              |
| NODES                        | nodes                                                               |
| SWARM                        | swarm                                                               |
| SECRETS                      | secrets                                                             |
| CONFIGS                      | configs                                                             |
| DISTRIBUTION                 | distribution                                                        |
| SESSION                      | session                                                             |
| PLUGINS                      | plugins                                                             |
| GRPC                         | grpc                                                                |
| BUILD                        | build                                                               |
| COMMIT                       | commit                                                              |
| AUTH                         | auth                                                                |
| ALLOW_START                  | containers/{id}/start                                               |
| ALLOW_STOP                   | containers/{id}/stop                                                |
| ALLOW_RESTARTS               | containers/{id}/stop, containers/{id}/restart, containers/{id}/kill |
| ALLOW_PAUSE                  | containers/{id}/pause                                               |
| ALLOW_UNPAUSE                | containers/{id}/unpause                                             |

Generated path regexes should mirror docker-socket-proxy's HAProxy section rules:

- API version prefixes are optional unless a path is intentionally emitted in
  explicit unversioned and versioned forms.
- Section rules are prefix matches, so generated regexes generally need `.*`
  when wollomatic's automatic end anchor would otherwise make them exact.
- The special container action rules must support both unversioned and versioned
  paths.

---

## Traefik Compatibility

Traefik compatibility is important.

Modern Traefik versions require:

```text
HEAD /_ping
```

The converter should therefore generate:

```text
SP_ALLOW_HEAD=/_ping
```

when PING is enabled.

---

## Parsing Rules

Input parser should:

- ignore comments
- ignore empty lines
- support quoted values
- support docker-compose env syntax
- tolerate whitespace
- normalize boolean-like values
- be case-insensitive
- warn on invalid boolean values and treat that toggle as disabled
- preserve known pass-through settings such as SOCKET_PATH and LOG_LEVEL where
  they map cleanly to wollomatic settings

Because the converter is line-based and intentionally not a full YAML editor, it
should be conservative about warnings: warn for unknown env-style variables, but
do not produce noisy warnings for ordinary docker-compose structural keys.

Accepted truthy values:
- 1
- true
- yes

Accepted falsy values:
- 0
- false
- no

---

## Output Rules

### ENV output

Use:
```env
SP_ALLOW_GET=...
```

### Command output

Use:
```text
-allowGET=...
```

---

## Svelte 5 Notes

Use modern Svelte 5 rune syntax where useful.

Prefer:
- $state
- $derived
- $effect

Avoid legacy patterns unless necessary.

---

## No Backend Rule

The application must remain fully static.

Forbidden:
- Express
- Node backend
- Server-side persistence
- API calls
- telemetry

Everything must run in-browser.

---

## UX Goals

The application should feel:

- fast
- simple
- transparent
- auditable
- copy-paste friendly

Primary target audience:
- Docker administrators
- DevOps engineers
- homelab users
- Traefik users
- security-conscious users

---

## Nice-to-have Features

Potential future additions:

- live validation
- regex preview
- generated docker-compose snippet
- copy-to-clipboard buttons
- dark mode
- preset templates
- compatibility warnings
- unsupported-rule warnings

---

## Non-Goals

Not planned:

- full HAProxy parsing
- reverse conversion
- YAML AST editing
- backend persistence
- user accounts
