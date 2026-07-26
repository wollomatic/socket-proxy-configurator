export type OutputMode = 'env' | 'command' | 'labels';
export type SourceProfile = 'tecnativa' | 'linuxserver';

export type LegacyConfig = Record<string, string>;

interface LegacyParseResult {
  config: LegacyConfig;
  invalidLines: string[];
  duplicateKeys: string[];
}

export interface ConversionResult {
  output: string;
  warnings: string[];
  enabled: string[];
  source: SourceProfile;
}

export interface ConversionOptions {
  source?: SourceProfile;
  networkListenCompatibility?: boolean;
  extendedHaproxyCompatibility?: boolean;
  includePodmanEndpoints?: boolean;
}

interface PathSpec {
  path: string;
  kind: 'section' | 'exact' | 'action';
}

interface PatternEntry {
  key: string;
  pattern: string;
  action: boolean;
}

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on', 'enable', 'enabled']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off', 'disable', 'disabled']);
const DEFAULT_ALLOW_FROM = '0.0.0.0/0';
const DEFAULT_LISTEN_IP = '0.0.0.0';
const VERSION_PREFIX = '(/v[\\d.]+)?';

const TECNATIVA_DEFAULTS: Record<string, boolean> = {
  EVENTS: true,
  PING: true,
  VERSION: true,
  POST: false,
  AUTH: false,
  SECRETS: false,
  BUILD: false,
  COMMIT: false,
  CONFIGS: false,
  CONTAINERS: false,
  ALLOW_START: false,
  ALLOW_STOP: false,
  ALLOW_RESTARTS: false,
  ALLOW_PAUSE: false,
  ALLOW_UNPAUSE: false,
  DISTRIBUTION: false,
  EXEC: false,
  GRPC: false,
  IMAGES: false,
  INFO: false,
  NETWORKS: false,
  NODES: false,
  PLUGINS: false,
  SERVICES: false,
  SESSION: false,
  SWARM: false,
  SYSTEM: false,
  TASKS: false,
  VOLUMES: false
};

const LIBPOD_DEFAULTS: Record<string, boolean> = {
  LIBPOD_ALLOW_PAUSE: false,
  LIBPOD_ALLOW_POD_PAUSE: false,
  LIBPOD_ALLOW_POD_RESTARTS: false,
  LIBPOD_ALLOW_POD_START: false,
  LIBPOD_ALLOW_POD_STOP: false,
  LIBPOD_ALLOW_POD_UNPAUSE: false,
  LIBPOD_ALLOW_RESTARTS: false,
  LIBPOD_ALLOW_START: false,
  LIBPOD_ALLOW_STOP: false,
  LIBPOD_ALLOW_UNPAUSE: false,
  LIBPOD_CONTAINERS: false,
  LIBPOD_EVENTS: false,
  LIBPOD_EXEC: false,
  LIBPOD_GENERATE: false,
  LIBPOD_IMAGES: false,
  LIBPOD_INFO: false,
  LIBPOD_MANIFESTS: false,
  LIBPOD_NETWORKS: false,
  LIBPOD_PING: true,
  LIBPOD_PLAY: false,
  LIBPOD_PODS: false,
  LIBPOD_SECRETS: false,
  LIBPOD_SYSTEM: false,
  LIBPOD_VERSION: true,
  LIBPOD_VOLUMES: false
};

const LINUXSERVER_DEFAULTS: Record<string, boolean> = {
  ...TECNATIVA_DEFAULTS,
  ...LIBPOD_DEFAULTS
};

const DEFAULTS_BY_SOURCE: Record<SourceProfile, Record<string, boolean>> = {
  tecnativa: TECNATIVA_DEFAULTS,
  linuxserver: LINUXSERVER_DEFAULTS
};

export function defaultLegacyInputForSource(source: SourceProfile = 'tecnativa'): string {
  return Object.entries(DEFAULTS_BY_SOURCE[source])
    .filter(([, enabled]) => enabled)
    .map(([key]) => `${key}=1`)
    .join('\n');
}

export const defaultLegacyInput = defaultLegacyInputForSource();

export function allLegacyOptionsInput(source: SourceProfile = 'tecnativa'): string {
  return Object.entries(DEFAULTS_BY_SOURCE[source])
    .map(([key, enabled]) => `${key}=${enabled ? '1' : '0'}`)
    .join('\n');
}

const PATHS: Record<string, PathSpec[]> = {
  ALLOW_RESTARTS: [{ path: 'containers/[a-zA-Z0-9_.-]+/(stop|restart|kill)', kind: 'action' }],
  ALLOW_START: [{ path: 'containers/[a-zA-Z0-9_.-]+/start', kind: 'action' }],
  ALLOW_STOP: [{ path: 'containers/[a-zA-Z0-9_.-]+/stop', kind: 'action' }],
  ALLOW_PAUSE: [{ path: 'containers/[a-zA-Z0-9_.-]+/pause', kind: 'action' }],
  ALLOW_UNPAUSE: [{ path: 'containers/[a-zA-Z0-9_.-]+/unpause', kind: 'action' }],
  AUTH: [{ path: 'auth', kind: 'section' }],
  BUILD: [{ path: 'build', kind: 'section' }],
  COMMIT: [{ path: 'commit', kind: 'section' }],
  CONFIGS: [{ path: 'configs', kind: 'section' }],
  CONTAINERS: [{ path: 'containers', kind: 'section' }],
  DISTRIBUTION: [{ path: 'distribution', kind: 'section' }],
  EVENTS: [{ path: 'events', kind: 'section' }],
  EXEC: [{ path: 'exec', kind: 'section' }],
  GRPC: [{ path: 'grpc', kind: 'section' }],
  IMAGES: [{ path: 'images', kind: 'section' }],
  INFO: [{ path: 'info', kind: 'section' }],
  NETWORKS: [{ path: 'networks', kind: 'section' }],
  NODES: [{ path: 'nodes', kind: 'section' }],
  PING: [{ path: '_ping', kind: 'exact' }],
  PLUGINS: [{ path: 'plugins', kind: 'section' }],
  SECRETS: [{ path: 'secrets', kind: 'section' }],
  SERVICES: [{ path: 'services', kind: 'section' }],
  SESSION: [{ path: 'session', kind: 'section' }],
  SWARM: [{ path: 'swarm', kind: 'section' }],
  SYSTEM: [{ path: 'system', kind: 'section' }],
  TASKS: [{ path: 'tasks', kind: 'section' }],
  VERSION: [{ path: 'version', kind: 'exact' }],
  VOLUMES: [{ path: 'volumes', kind: 'section' }],
  LIBPOD_ALLOW_RESTARTS: [{ path: 'libpod/containers/[a-zA-Z0-9_.-]+/(stop|restart|kill)', kind: 'action' }],
  LIBPOD_ALLOW_START: [{ path: 'libpod/containers/[a-zA-Z0-9_.-]+/start', kind: 'action' }],
  LIBPOD_ALLOW_STOP: [{ path: 'libpod/containers/[a-zA-Z0-9_.-]+/stop', kind: 'action' }],
  LIBPOD_ALLOW_PAUSE: [{ path: 'libpod/containers/[a-zA-Z0-9_.-]+/pause', kind: 'action' }],
  LIBPOD_ALLOW_UNPAUSE: [{ path: 'libpod/containers/[a-zA-Z0-9_.-]+/unpause', kind: 'action' }],
  LIBPOD_ALLOW_POD_RESTARTS: [{ path: 'libpod/pods/[a-zA-Z0-9_.-]+/(stop|restart|kill)', kind: 'action' }],
  LIBPOD_ALLOW_POD_START: [{ path: 'libpod/pods/[a-zA-Z0-9_.-]+/start', kind: 'action' }],
  LIBPOD_ALLOW_POD_STOP: [{ path: 'libpod/pods/[a-zA-Z0-9_.-]+/stop', kind: 'action' }],
  LIBPOD_ALLOW_POD_PAUSE: [{ path: 'libpod/pods/[a-zA-Z0-9_.-]+/pause', kind: 'action' }],
  LIBPOD_ALLOW_POD_UNPAUSE: [{ path: 'libpod/pods/[a-zA-Z0-9_.-]+/unpause', kind: 'action' }],
  LIBPOD_CONTAINERS: [{ path: 'libpod/containers', kind: 'section' }],
  LIBPOD_EVENTS: [{ path: 'libpod/events', kind: 'section' }],
  LIBPOD_EXEC: [{ path: 'libpod/exec', kind: 'section' }],
  LIBPOD_GENERATE: [{ path: 'libpod/generate', kind: 'section' }],
  LIBPOD_IMAGES: [{ path: 'libpod/images', kind: 'section' }],
  LIBPOD_INFO: [{ path: 'libpod/info', kind: 'section' }],
  LIBPOD_MANIFESTS: [{ path: 'libpod/manifests', kind: 'section' }],
  LIBPOD_NETWORKS: [{ path: 'libpod/networks', kind: 'section' }],
  LIBPOD_PING: [{ path: 'libpod/_ping', kind: 'exact' }],
  LIBPOD_PLAY: [{ path: 'libpod/play', kind: 'section' }],
  LIBPOD_PODS: [{ path: 'libpod/pods', kind: 'section' }],
  LIBPOD_SECRETS: [{ path: 'libpod/secrets', kind: 'section' }],
  LIBPOD_SYSTEM: [{ path: 'libpod/system', kind: 'section' }],
  LIBPOD_VERSION: [{ path: 'libpod/version', kind: 'exact' }],
  LIBPOD_VOLUMES: [{ path: 'libpod/volumes', kind: 'section' }]
};

const ALL_WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'CONNECT', 'TRACE'] as const;
const DOCKER_WRITE_METHODS = ['POST', 'PUT', 'DELETE'] as const;
const READ_METHODS = ['GET', 'HEAD'] as const;
const SOURCE_SETTING_KEYS = new Set([
  'SOCKET_PATH',
  'LOG_LEVEL',
  'BIND_CONFIG',
  'DISABLE_IPV6',
  'TZ'
]);
const TARGET_SETTING_KEYS = new Set([
  'SP_SOCKETPATH',
  'SP_LOGLEVEL',
  'LISTENIP',
  'LISTEN_IP',
  'SP_LISTENIP',
  'ALLOWFROM',
  'ALLOW_FROM',
  'SP_ALLOWFROM'
]);
const ALL_BOOLEAN_KEYS = new Set([
  ...Object.keys(TECNATIVA_DEFAULTS),
  ...Object.keys(LIBPOD_DEFAULTS)
]);
const KNOWN_KEYS = new Set([
  ...ALL_BOOLEAN_KEYS,
  ...SOURCE_SETTING_KEYS,
  ...TARGET_SETTING_KEYS
]);

function normalizeValue(value: string): string {
  let normalized = value.trim();
  while (
    normalized.length >= 2 &&
    ((normalized.startsWith('"') && normalized.endsWith('"')) ||
      (normalized.startsWith("'") && normalized.endsWith("'")))
  ) {
    normalized = normalized.slice(1, -1).trim();
  }
  return normalized;
}

function stripInlineComment(value: string): string {
  let quote: string | undefined;
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    const previous = value[i - 1];
    if ((char === '"' || char === "'") && previous !== '\\') {
      quote = quote === char ? undefined : quote ?? char;
    }
    if (char === '#' && !quote && (i === 0 || /\s/.test(previous))) {
      return value.slice(0, i).trimEnd();
    }
  }
  return value;
}

function parseBool(value: string | undefined, fallback: boolean): { value: boolean; invalid?: string } {
  if (value === undefined) return { value: fallback };
  const normalized = normalizeValue(value).toLowerCase();
  if (TRUE_VALUES.has(normalized)) return { value: true };
  if (FALSE_VALUES.has(normalized)) return { value: false };
  return { value: false, invalid: value };
}

function isComposeStructuralLine(line: string): boolean {
  return line.includes(':') || /^\w[\w.-]*\/[\w./:-]+$/.test(line);
}

function parseLegacyInputWithDiagnostics(input: string): LegacyParseResult {
  const config: LegacyConfig = {};
  const invalidLines: string[] = [];
  const seenKeys = new Set<string>();
  const duplicateKeys = new Set<string>();
  for (const rawLine of input.split(/\r?\n/)) {
    let line = stripInlineComment(rawLine).trim();
    if (!line || line.startsWith('#')) continue;
    line = line.replace(/^[-*]\s*/, '').trim();
    line = normalizeValue(line);
    if (/^environment:\s*$/i.test(line)) continue;

    line = line.replace(/^export\s+/i, '');

    const kv = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*([:=])\s*(.*)$/);
    if (!kv) {
      if (!isComposeStructuralLine(line)) {
        invalidLines.push(line);
      }
      continue;
    }

    const key = kv[1].toUpperCase();
    const isLikelyEnvVariable = kv[2] === '=' || KNOWN_KEYS.has(key) || /^[A-Z0-9_]+$/.test(kv[1]);
    if (!isLikelyEnvVariable) continue;

    if (seenKeys.has(key)) {
      duplicateKeys.add(key);
    }
    seenKeys.add(key);
    config[key] = normalizeValue(stripInlineComment(kv[3]));
  }
  return { config, invalidLines, duplicateKeys: [...duplicateKeys] };
}

export function parseLegacyInput(input: string): LegacyConfig {
  return parseLegacyInputWithDiagnostics(input).config;
}

function asEnvLine(key: string, value: string, index?: number): string {
  const suffix = index && index > 1 ? `_${index}` : '';
  return `${key}${suffix}=${value}`;
}

function asCommandLine(flag: string, value: string): string {
  return `${flag}=${value}`;
}

function asLabelLine(method: string, value: string, index: number): string {
  const suffix = index > 0 ? `.${index}` : '';
  return `  - 'socket-proxy.allow.${method.toLowerCase()}${suffix}=${value}'`;
}

function buildPattern(spec: PathSpec, extendedCompatibility: boolean): string {
  const base = `${VERSION_PREFIX}/${spec.path}`;
  if (extendedCompatibility) {
    return `(?i:${base}.*)`;
  }
  return spec.kind === 'section' ? `${base}(/.*)?` : base;
}

function patternsFor(keys: string[], extendedCompatibility: boolean): PatternEntry[] {
  return keys.flatMap((key) =>
    (PATHS[key] ?? []).map((spec) => ({
      key,
      pattern: buildPattern(spec, extendedCompatibility),
      action: spec.kind === 'action'
    }))
  );
}

function pingFirst(patterns: PatternEntry[]): PatternEntry[] {
  const pingKeys = new Set(['PING', 'LIBPOD_PING']);
  return [
    ...patterns.filter(({ key }) => pingKeys.has(key)),
    ...patterns.filter(({ key }) => !pingKeys.has(key))
  ];
}

function firstConfigured(cfg: LegacyConfig, keys: string[]): string | undefined {
  for (const key of keys) {
    if (cfg[key] !== undefined && normalizeValue(cfg[key]) !== '') {
      return normalizeValue(cfg[key]);
    }
  }
  return undefined;
}

function mapLogLevel(rawValue: string | undefined, warnings: string[]): string | undefined {
  if (rawValue === undefined) return undefined;
  const normalized = normalizeValue(rawValue).toLowerCase();
  const mapped: Record<string, string> = {
    debug: 'DEBUG',
    info: 'INFO',
    notice: 'INFO',
    warn: 'WARN',
    warning: 'WARN',
    error: 'ERROR',
    err: 'ERROR',
    crit: 'ERROR',
    alert: 'ERROR',
    emerg: 'ERROR'
  };
  const result = mapped[normalized];
  if (!result) {
    warnings.push(
      `Unsupported LOG_LEVEL value ${JSON.stringify(rawValue)} ignored. wollomatic/socket-proxy accepts DEBUG, INFO, WARN, or ERROR.`
    );
    return undefined;
  }
  if (['notice', 'err', 'crit', 'alert', 'emerg'].includes(normalized)) {
    warnings.push(`LOG_LEVEL=${rawValue} is approximated as ${result} for wollomatic/socket-proxy.`);
  }
  return result;
}

function patternsAllowedForWrite(
  patterns: PatternEntry[],
  source: SourceProfile,
  postEnabled: boolean
): PatternEntry[] {
  if (postEnabled) return patterns;
  if (source === 'linuxserver') return patterns.filter(({ action }) => action);
  return [];
}

export function convert(input: string, mode: OutputMode, options: ConversionOptions = {}): ConversionResult {
  const source = options.source ?? 'tecnativa';
  const defaults = DEFAULTS_BY_SOURCE[source];
  const extendedCompatibility = options.extendedHaproxyCompatibility === true;
  const includePodmanEndpoints = source === 'linuxserver' && options.includePodmanEndpoints !== false;
  const parsedInput = parseLegacyInputWithDiagnostics(input);
  const cfg = parsedInput.config;
  const warnings: string[] = [];
  const bools = new Map<string, boolean>();

  function enabledValue(key: string): boolean {
    const cached = bools.get(key);
    if (cached !== undefined) return cached;
    const parsed = parseBool(cfg[key], defaults[key]);
    if (parsed.invalid !== undefined) {
      warnings.push(
        `Invalid boolean value for ${key}: ${JSON.stringify(parsed.invalid)}. Treating it as disabled.`
      );
    }
    bools.set(key, parsed.value);
    return parsed.value;
  }

  const socketPath = firstConfigured(cfg, ['SOCKET_PATH', 'SP_SOCKETPATH']);
  const logLevel = mapLogLevel(firstConfigured(cfg, ['LOG_LEVEL', 'SP_LOGLEVEL']), warnings);
  const configuredAllowFrom = firstConfigured(cfg, ['SP_ALLOWFROM', 'ALLOWFROM', 'ALLOW_FROM']);
  const configuredListenIp = firstConfigured(cfg, ['SP_LISTENIP', 'LISTENIP', 'LISTEN_IP']);
  const allowFrom = configuredAllowFrom ?? (options.networkListenCompatibility ? DEFAULT_ALLOW_FROM : undefined);
  const listenIp = configuredListenIp ?? (options.networkListenCompatibility ? DEFAULT_LISTEN_IP : undefined);
  const sourceEnabled = Object.keys(defaults).filter((key) => enabledValue(key));
  const omittedPodmanSections = sourceEnabled.filter((key) => key.startsWith('LIBPOD_'));
  const enabled = includePodmanEndpoints
    ? sourceEnabled
    : sourceEnabled.filter((key) => !key.startsWith('LIBPOD_'));
  const postEnabled = enabledValue('POST');
  const enabledSections = enabled.filter((key) => key !== 'POST');
  const patterns = pingFirst(patternsFor(enabledSections, extendedCompatibility));
  const writeMethods = extendedCompatibility ? ALL_WRITE_METHODS : DOCKER_WRITE_METHODS;
  const writePatterns = patternsAllowedForWrite(patterns, source, postEnabled);

  if (extendedCompatibility) {
    warnings.push(
      'Broader source-proxy permissions are enabled. The generated allowlist uses case-insensitive prefix matching and additional HTTP methods, so it can pass requests that are not valid Docker or Podman API endpoints.'
    );
  }

  if (source === 'linuxserver' && !includePodmanEndpoints && omittedPodmanSections.length > 0) {
    warnings.push(
      `Podman-specific endpoints are excluded from the target configuration. Enabled source settings not converted: ${omittedPodmanSections.join(', ')}.`
    );
  }

  if (patterns.length === 0) {
    warnings.push('No Docker or Podman API section is enabled. The generated configuration would block all proxied API requests.');
  }

  for (const key of Object.keys(cfg)) {
    if (!KNOWN_KEYS.has(key)) {
      warnings.push(`Unknown docker-socket-proxy variable ignored: ${key}`);
    } else if (key.startsWith('LIBPOD_') && source !== 'linuxserver') {
      warnings.push(`${key} is a LinuxServer-only variable and is ignored for the Tecnativa source profile.`);
    }
  }

  for (const line of parsedInput.invalidLines) {
    warnings.push(`Invalid input line ignored: ${JSON.stringify(line)}`);
  }

  for (const key of parsedInput.duplicateKeys) {
    warnings.push(`Duplicate docker-socket-proxy variable found: ${key}. Using the last value.`);
  }

  if (cfg.BIND_CONFIG) {
    warnings.push('BIND_CONFIG is not converted directly. Use listenip/proxyport or Compose port mappings for wollomatic/socket-proxy instead.');
  }
  if (cfg.TZ) {
    warnings.push('TZ has no equivalent in the distroless wollomatic/socket-proxy image and is not converted.');
  }
  if (cfg.DISABLE_IPV6 !== undefined) {
    const disableIpv6 = parseBool(cfg.DISABLE_IPV6, false);
    if (disableIpv6.invalid !== undefined) {
      warnings.push(
        `Invalid boolean value for DISABLE_IPV6: ${JSON.stringify(disableIpv6.invalid)}. Treating it as disabled.`
      );
    } else if (options.networkListenCompatibility && !disableIpv6.value && !configuredListenIp) {
      warnings.push(
        'DISABLE_IPV6=0 is not reproduced by the IPv4 network-listener compatibility default. Set SP_LISTENIP explicitly to an IPv6 address if required.'
      );
    } else if (!options.networkListenCompatibility && disableIpv6.value && !configuredListenIp) {
      warnings.push(
        'DISABLE_IPV6 is not emitted unless network-listener compatibility or an explicit SP_LISTENIP value is used.'
      );
    }
  }
  if (options.networkListenCompatibility && mode !== 'labels' && (!configuredAllowFrom || !configuredListenIp)) {
    warnings.push(
      `Docker-network listen compatibility uses listenip=${listenIp ?? configuredListenIp} and allowfrom=${allowFrom ?? configuredAllowFrom}. Restrict this to trusted client CIDRs or hostnames when possible.`
    );
  }
  if (mode === 'labels') {
    warnings.push(
      'Docker label allowlists apply per client container. Enable -proxycontainername/SP_PROXYCONTAINERNAME on the socket-proxy container so labels can be discovered.'
    );
  }

  const lines: string[] = [];
  if (mode === 'env') {
    if (listenIp) lines.push(asEnvLine('SP_LISTENIP', listenIp));
    if (allowFrom) lines.push(asEnvLine('SP_ALLOWFROM', allowFrom));
    if (socketPath) lines.push(asEnvLine('SP_SOCKETPATH', socketPath));
    if (logLevel) lines.push(asEnvLine('SP_LOGLEVEL', logLevel));
    for (const method of READ_METHODS) {
      patterns.forEach(({ pattern }, idx) => lines.push(asEnvLine(`SP_ALLOW_${method}`, pattern, idx + 1)));
    }
    for (const method of writeMethods) {
      writePatterns.forEach(({ pattern }, idx) => lines.push(asEnvLine(`SP_ALLOW_${method}`, pattern, idx + 1)));
    }
  } else if (mode === 'labels') {
    lines.push('labels:');
    for (const method of READ_METHODS) {
      patterns.forEach(({ pattern }, idx) => lines.push(asLabelLine(method, pattern, idx)));
    }
    for (const method of writeMethods) {
      writePatterns.forEach(({ pattern }, idx) => lines.push(asLabelLine(method, pattern, idx)));
    }
  } else {
    if (listenIp) lines.push(asCommandLine('-listenip', listenIp));
    if (allowFrom) lines.push(asCommandLine('-allowfrom', allowFrom));
    if (socketPath) lines.push(asCommandLine('-socketpath', socketPath));
    if (logLevel) lines.push(asCommandLine('-loglevel', logLevel));
    for (const method of READ_METHODS) {
      patterns.forEach(({ pattern }) => lines.push(asCommandLine(`-allow${method}`, pattern)));
    }
    for (const method of writeMethods) {
      writePatterns.forEach(({ pattern }) => lines.push(asCommandLine(`-allow${method}`, pattern)));
    }
  }

  return { output: lines.join('\n'), warnings, enabled, source };
}
