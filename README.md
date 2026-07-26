# socket-proxy-configurator

A static browser application for converting configurations from
[`Tecnativa/docker-socket-proxy`](https://github.com/Tecnativa/docker-socket-proxy)
or
[`linuxserver/docker-socket-proxy`](https://github.com/linuxserver/docker-socket-proxy)
into allowlist configuration for
[`wollomatic/socket-proxy`](https://github.com/wollomatic/socket-proxy).

URL: https://socket-proxy-configurator.wollomatic.dev/

The application runs entirely in the browser. It has no backend, makes no API
calls, and never sends pasted configuration away from the user's machine.

> [!NOTE]
> This is an early release. Review generated allowlists before using them in
> production.

## How it works

Select the proxy that the input was written for:

- **Tecnativa** is the default and follows Tecnativa's global `POST` gate.
- **LinuxServer** additionally supports all documented `LIBPOD_*` settings and
  its container and pod action toggles that work even when `POST=0`.

The **Include Podman-specific endpoints** option is enabled by default for the
LinuxServer profile. Disable it to omit every native `/libpod/...` rule from the
target while keeping Docker-compatible LinuxServer rules. A warning lists any
enabled `LIBPOD_*` settings whose paths were not converted. The option is
disabled in the Tecnativa profile.

The converter accepts plain env files and common line-based Docker Compose
environment snippets. It ignores comments and structural Compose lines,
normalizes keys case-insensitively, supports quoted values, and warns about
invalid or unsupported settings.

Enabled boolean values are `1`, `true`, `yes`, `on`, `enable`, and `enabled`.
Disabled values are `0`, `false`, `no`, `off`, `disable`, and `disabled`.

## Default output policy

The default policy is deliberately limited to valid-looking API path segments
and HTTP methods used by Docker:

- `POST=0` normally produces GET and HEAD rules.
- `POST=1` additionally produces POST, PUT, and DELETE rules.
- Section paths use segment boundaries, for example
  `(/v[\d.]+)?/containers(/.*)?`.
- Singleton endpoints such as `/_ping` and `/version`, plus action endpoints,
  remain exact.
- LinuxServer action toggles are the exception to the global `POST` rule and
  produce their write rules even when `POST=0`.

This prevents a section such as `CONTAINERS=1` from also allowing an obviously
unrelated path such as `/containers-invalid`.

## Broader source-proxy permissions

The optional **Include source-proxy permissions beyond Docker API requirements**
setting reproduces the broader source ACL behavior:

- PATCH, OPTIONS, CONNECT, and TRACE are added where writes are allowed.
- Regexes become case-insensitive HAProxy-style prefix matches, for example
  `(?i:(/v[\d.]+)?/containers.*)`.

The generated regexes never contain explicit `^` or `$` anchors because
wollomatic/socket-proxy adds them internally.

## Output formats

The application generates:

- raw command arguments, such as `-allowGET=(/v[\d.]+)?/_ping`
- unquoted environment entries, such as
  `SP_ALLOW_GET=(/v[\d.]+)?/_ping`
- a Compose-compatible labels block, such as:

  ```yaml
  labels:
    - 'socket-proxy.allow.get=(/v[\d.]+)?/_ping'
    - 'socket-proxy.allow.get.1=(/v[\d.]+)?/events(/.*)?'
  ```

Multiple environment allowlists use wollomatic/socket-proxy's numbered suffix
format, such as `SP_ALLOW_GET_2`. Additional label rules use numbered suffixes
such as `.1`. Label-based allowlists require `SP_PROXYCONTAINERNAME` or
`-proxycontainername` on the socket-proxy container.

`SOCKET_PATH` maps to the target `socketpath` setting when it is a conventional
absolute Unix socket path containing only letters, digits, `.`, `_`, `-`, and
`/`. Other socket paths are ignored with an explicit warning. Supported source
log levels are mapped to the DEBUG, INFO, WARN, and ERROR levels accepted by
wollomatic/socket-proxy. Settings without a clean target equivalent, including
`DISABLE_IPV6`, `BIND_CONFIG`, and LinuxServer `TZ`, produce explicit warnings.

Optional network-listener compatibility can add `listenip` and `allowfrom`
defaults. Restrict `allowfrom` to trusted containers, hostnames, or CIDRs when
possible.

## Technology

- Svelte 5
- Vite
- TypeScript
- Static single-page application

## Development

```text
pnpm test
pnpm build
```

## AI assistance notice

This application was created with the help of artificial intelligence.

## License

MIT
