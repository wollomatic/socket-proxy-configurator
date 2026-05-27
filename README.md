# socket-proxy-configurator

A static web application for converting
[`docker-socket-proxy`](https://github.com/Tecnativa/docker-socket-proxy)
environment-style configuration into allowlist configuration for
[`wollomatic/socket-proxy`](https://github.com/wollomatic/socket-proxy).

The application runs entirely in the browser. It does not require a backend,
does not call external APIs, and does not send pasted configuration data away
from the user's machine.

URL: https://socket-proxy-configurator.wollomatic.dev/

> [!NOTE]
> This is an early release. The resulting allowlists should be carefully
> reviewed before use in production.

## What It Does

Some docker-socket-proxies use section-based environment variables such as
`CONTAINERS=1`, `IMAGES=0`, `PING=1`, and `POST=0` to control access to Docker
API paths.

`wollomatic/socket-proxy` uses explicit regular-expression allowlists per HTTP
method instead. This converter translates the familiar `docker-socket-proxy`
toggles into compatible `wollomatic/socket-proxy` rules.

For example, this input:

```env
CONTAINERS=1
EVENTS=1
PING=1
VERSION=1
POST=0
```

can be converted into command-line allowlist arguments such as:

```text
- '-allowGET=(/v[\d.]+)?/events.*'
- '-allowGET=/_ping'
- '-allowGET=/v[\d.]+/_ping'
- '-allowGET=/version'
- '-allowGET=/v[\d.]+/version'
- '-allowGET=(/v[\d.]+)?/containers.*'
- '-allowHEAD=/_ping'
- '-allowHEAD=/v[\d.]+/_ping'
- '-allowHEAD=(/v[\d.]+)?/events.*'
- '-allowHEAD=/version'
- '-allowHEAD=/v[\d.]+/version'
- '-allowHEAD=(/v[\d.]+)?/containers.*'
```

The generated output is meant to emulate `docker-socket-proxy` behavior as
closely as possible while using the allowlist model provided by
`wollomatic/socket-proxy`.

## Supported Input

The converter accepts pasted configuration in common formats:

- plain environment variable files
- `docker-compose.yml` environment snippets
- lines prefixed with `export`
- quoted values
- comments and empty lines

Boolean values are normalized case-insensitively. Supported enabled values
include `1`, `true`, `yes`, `on`, `enable`, and `enabled`. Supported disabled
values include `0`, `false`, `no`, `off`, `disable`, and `disabled`.

Unknown or invalid environment-style variables are ignored and shown as
warnings so the generated result remains auditable.

## Output Formats

The web app can generate:

- command-line arguments
- environment variables
- Docker labels

It also supports optional network listener compatibility settings for setups
that previously exposed `docker-socket-proxy` over a Docker network.

## Compatibility Notes

- `POST=0` generates only `GET` and `HEAD` allowlists.
- `POST=1` additionally generates write-method allowlists for enabled Docker
  API sections.
- `HEAD /_ping` is generated when `PING` is enabled, which is required by
  modern Traefik health checks.
- Regular expressions are emitted without explicit `^` and `$` anchors because
  `wollomatic/socket-proxy` adds those internally.
- Generated rules should be reviewed and tested before use in production.

## Technology

- Svelte 5
- Vite
- TypeScript
- Static single-page application

## AI Assistance Notice

This application was created with the help of artificial intelligence.

## License

MIT
