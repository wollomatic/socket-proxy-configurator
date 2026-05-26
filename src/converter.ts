export type OutputMode = 'env' | 'command' | 'labels';

export type LegacyConfig = Record<string, string>;

interface LegacyParseResult {
  config: LegacyConfig;
  invalidLines: string[];
}

export interface ConversionResult {
  output: string;
  warnings: string[];
  enabled: string[];
}

export interface ConversionOptions {
  networkListenCompatibility?: boolean;
}

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on', 'enable', 'enabled']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off', 'disable', 'disabled']);
const DEFAULT_ALLOW_FROM = '0.0.0.0/0';
const DEFAULT_LISTEN_IP = '0.0.0.0';

const DEFAULTS: Record<string, boolean> = {
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

const PATHS: Record<string, string[]> = {
  ALLOW_RESTARTS: ['(/v[\\d.]+)?/containers/[a-zA-Z0-9_.-]+/(stop|restart|kill).*'],
  ALLOW_START: ['(/v[\\d.]+)?/containers/[a-zA-Z0-9_.-]+/start.*'],
  ALLOW_STOP: ['(/v[\\d.]+)?/containers/[a-zA-Z0-9_.-]+/stop.*'],
  ALLOW_PAUSE: ['(/v[\\d.]+)?/containers/[a-zA-Z0-9_.-]+/pause.*'],
  ALLOW_UNPAUSE: ['(/v[\\d.]+)?/containers/[a-zA-Z0-9_.-]+/unpause.*'],
  AUTH: ['(/v[\\d.]+)?/auth.*'],
  BUILD: ['(/v[\\d.]+)?/build.*'],
  COMMIT: ['(/v[\\d.]+)?/commit.*'],
  CONFIGS: ['(/v[\\d.]+)?/configs.*'],
  CONTAINERS: ['(/v[\\d.]+)?/containers.*'],
  DISTRIBUTION: ['(/v[\\d.]+)?/distribution.*'],
  EVENTS: ['(/v[\\d.]+)?/events.*'],
  EXEC: ['(/v[\\d.]+)?/exec.*'],
  GRPC: ['(/v[\\d.]+)?/grpc.*'],
  IMAGES: ['(/v[\\d.]+)?/images.*'],
  INFO: ['(/v[\\d.]+)?/info.*'],
  NETWORKS: ['(/v[\\d.]+)?/networks.*'],
  NODES: ['(/v[\\d.]+)?/nodes.*'],
  PING: ['/_ping', '/v[\\d.]+/_ping'],
  PLUGINS: ['(/v[\\d.]+)?/plugins.*'],
  SECRETS: ['(/v[\\d.]+)?/secrets.*'],
  SERVICES: ['(/v[\\d.]+)?/services.*'],
  SESSION: ['(/v[\\d.]+)?/session.*'],
  SWARM: ['(/v[\\d.]+)?/swarm.*'],
  SYSTEM: ['(/v[\\d.]+)?/system.*'],
  TASKS: ['(/v[\\d.]+)?/tasks.*'],
  VERSION: ['/version', '/v[\\d.]+/version'],
  VOLUMES: ['(/v[\\d.]+)?/volumes.*']
};

const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'CONNECT', 'TRACE'] as const;
const PASSTHROUGH_KEYS = new Set([
  'SOCKET_PATH',
  'SP_SOCKETPATH',
  'LOG_LEVEL',
  'SP_LOGLEVEL',
  'BIND_CONFIG',
  'LISTENIP',
  'LISTEN_IP',
  'SP_LISTENIP',
  'ALLOWFROM',
  'ALLOW_FROM',
  'SP_ALLOWFROM'
]);
const KNOWN_KEYS = new Set([...Object.keys(DEFAULTS), ...PASSTHROUGH_KEYS]);

interface PatternEntry {
  key: string;
  pattern: string;
}

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
  if (value === undefined || value === '') return { value: fallback };
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
  for (const rawLine of input.split(/\r?\n/)) {
    let line = stripInlineComment(rawLine).trim();
    if (!line || line.startsWith('#')) continue;
    line = line.replace(/^[-*]\s*/, '').trim();
    line = normalizeValue(line);
    if (/^environment:\s*$/i.test(line)) continue;

    const envPrefix = /^export\s+/i;
    line = line.replace(envPrefix, '');

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

    config[key] = normalizeValue(stripInlineComment(kv[3]));
  }
  return { config, invalidLines };
}

export function parseLegacyInput(input: string): LegacyConfig {
  return parseLegacyInputWithDiagnostics(input).config;
}

function asEnvLine(key: string, value: string, index?: number): string {
  const suffix = index && index > 1 ? `_${index}` : '';
  return `${key}${suffix}=${JSON.stringify(value)}`;
}

function asCommandLine(flag: string, value?: string): string {
  return value === undefined ? `- '${flag}'` : `- '${flag}=${value}'`;
}

function asLabelLine(method: string, value: string, index: number): string {
  const suffix = index > 0 ? `.${index}` : '';
  return `  - 'socket-proxy.allow.${method.toLowerCase()}${suffix}=${value}'`;
}

function patternsFor(keys: string[]): PatternEntry[] {
  return keys.flatMap((key) => (PATHS[key] ?? []).map((pattern) => ({ key, pattern })));
}

function headPatternsFor(keys: string[]): PatternEntry[] {
  const allPatterns = patternsFor(keys);
  return [
    ...allPatterns.filter(({ key }) => key === 'PING'),
    ...allPatterns.filter(({ key }) => key !== 'PING')
  ];
}

function firstConfigured(cfg: LegacyConfig, keys: string[]): string | undefined {
  for (const key of keys) {
    if (cfg[key]) return normalizeValue(cfg[key]);
  }
  return undefined;
}

export function convert(input: string, mode: OutputMode, options: ConversionOptions = {}): ConversionResult {
  const parsedInput = parseLegacyInputWithDiagnostics(input);
  const cfg = parsedInput.config;
  const warnings: string[] = [];
  const bools = new Map<string, boolean>();

  function enabledValue(key: string): boolean {
    const cached = bools.get(key);
    if (cached !== undefined) return cached;
    const parsed = parseBool(cfg[key], DEFAULTS[key]);
    if (parsed.invalid !== undefined) {
      warnings.push(
        `Invalid boolean value for ${key}: ${JSON.stringify(parsed.invalid)}. Treating it as disabled.`
      );
    }
    bools.set(key, parsed.value);
    return parsed.value;
  }

  const socketPath = firstConfigured(cfg, ['SOCKET_PATH', 'SP_SOCKETPATH']);
  const logLevel = firstConfigured(cfg, ['LOG_LEVEL', 'SP_LOGLEVEL'])?.toUpperCase();
  const configuredAllowFrom = firstConfigured(cfg, ['SP_ALLOWFROM', 'ALLOWFROM', 'ALLOW_FROM']);
  const configuredListenIp = firstConfigured(cfg, ['SP_LISTENIP', 'LISTENIP', 'LISTEN_IP']);
  const allowFrom = configuredAllowFrom ?? (options.networkListenCompatibility ? DEFAULT_ALLOW_FROM : undefined);
  const listenIp = configuredListenIp ?? (options.networkListenCompatibility ? DEFAULT_LISTEN_IP : undefined);
  const enabled = Object.keys(DEFAULTS).filter((key) => enabledValue(key));
  const postEnabled = enabledValue('POST');

  const enabledSections = enabled.filter((key) => key !== 'POST');
  const patterns = patternsFor(enabledSections);
  const headPatterns = headPatternsFor(enabledSections);

  if (patterns.length === 0) {
    warnings.push('No Docker API section is enabled. The generated configuration would block all Docker requests.');
  }

  for (const key of Object.keys(cfg)) {
    if (!KNOWN_KEYS.has(key)) {
      warnings.push(`Unknown docker-socket-proxy variable ignored: ${key}`);
    }
  }

  for (const line of parsedInput.invalidLines) {
    warnings.push(`Invalid input line ignored: ${JSON.stringify(line)}`);
  }

  if (cfg.BIND_CONFIG) {
    warnings.push('BIND_CONFIG is not converted directly. Use listenip/proxyport or Compose port mappings for wollomatic/socket-proxy instead.');
  }
  if (options.networkListenCompatibility && mode !== 'labels' && (!configuredAllowFrom || !configuredListenIp)) {
    warnings.push(
      `Docker-network listen compatibility uses listenip=${listenIp ?? configuredListenIp} and allowfrom=${allowFrom ?? configuredAllowFrom}. Restrict this to trusted client CIDRs or hostnames when possible.`
    );
  }
  if (mode === 'labels') {
    warnings.push(
      'Docker label allowlists apply per client container. Enable proxycontainername/SP_PROXYCONTAINERNAME on the socket-proxy container so labels can be discovered.'
    );
  }

  const lines: string[] = [];
  if (mode === 'env') {
    if (listenIp) lines.push(asEnvLine('SP_LISTENIP', listenIp));
    if (allowFrom) lines.push(asEnvLine('SP_ALLOWFROM', allowFrom));
    if (socketPath) lines.push(asEnvLine('SP_SOCKETPATH', socketPath));
    if (logLevel) lines.push(asEnvLine('SP_LOGLEVEL', logLevel));
    patterns.forEach(({ pattern }, idx) => lines.push(asEnvLine('SP_ALLOW_GET', pattern, idx + 1)));
    headPatterns.forEach(({ pattern }, idx) => lines.push(asEnvLine('SP_ALLOW_HEAD', pattern, idx + 1)));
    if (postEnabled) {
      for (const method of WRITE_METHODS) {
        patterns.forEach(({ pattern }, idx) => lines.push(asEnvLine(`SP_ALLOW_${method}`, pattern, idx + 1)));
      }
    }
  } else if (mode === 'labels') {
    lines.push('labels:');
    patterns.forEach(({ pattern }, idx) => lines.push(asLabelLine('GET', pattern, idx)));
    headPatterns.forEach(({ pattern }, idx) => lines.push(asLabelLine('HEAD', pattern, idx)));
    if (postEnabled) {
      for (const method of WRITE_METHODS) {
        patterns.forEach(({ pattern }, idx) => lines.push(asLabelLine(method, pattern, idx)));
      }
    }
  } else {
    if (listenIp) lines.push(asCommandLine('-listenip', listenIp));
    if (allowFrom) lines.push(asCommandLine('-allowfrom', allowFrom));
    if (socketPath) lines.push(asCommandLine('-socketpath', socketPath));
    if (logLevel) lines.push(asCommandLine('-loglevel', logLevel));
    patterns.forEach(({ pattern }) => lines.push(asCommandLine('-allowGET', pattern)));
    headPatterns.forEach(({ pattern }) => lines.push(asCommandLine('-allowHEAD', pattern)));
    if (postEnabled) {
      for (const method of WRITE_METHODS) {
        patterns.forEach(({ pattern }) => lines.push(asCommandLine(`-allow${method}`, pattern)));
      }
    }
  }

  return { output: lines.join('\n'), warnings, enabled };
}
