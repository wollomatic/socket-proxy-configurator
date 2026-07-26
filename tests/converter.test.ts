import assert from 'node:assert/strict';
import {
  allLegacyOptionsInput,
  convert,
  defaultLegacyInput,
  defaultLegacyInputForSource,
  parseLegacyInput,
  type SourceProfile
} from '../src/converter.ts';

function lines(output: string): string[] {
  return output ? output.split('\n') : [];
}

function onlyEnabled(source: SourceProfile, key: string, extra: Record<string, string> = {}): string {
  const values = Object.fromEntries(
    allLegacyOptionsInput(source)
      .split('\n')
      .map((line) => {
        const [name] = line.split('=');
        return [name, '0'];
      })
  );
  values[key] = '1';
  Object.assign(values, extra);
  return Object.entries(values).map(([name, value]) => `${name}=${value}`).join('\n');
}

{
  const parsed = parseLegacyInput(`
services:
  proxy:
    image: tecnativa/docker-socket-proxy
    environment:
      - "containers=yes"
      ping: false
      VERSION: "enabled" # keep version
      LOG_LEVEL: debug
`);

  assert.equal(parsed.CONTAINERS, 'yes');
  assert.equal(parsed.PING, 'false');
  assert.equal(parsed.VERSION, 'enabled');
  assert.equal(parsed.LOG_LEVEL, 'debug');
  assert.equal(parsed.IMAGE, undefined);
}

{
  const result = convert('EVENTS=1\nPING=1\nVERSION=1', 'command', { source: 'tecnativa' });

  assert.equal(result.source, 'tecnativa');
  assert.equal(
    result.output,
    [
      '-allowGET=(/v[\\d.]+)?/_ping',
      '-allowGET=(/v[\\d.]+)?/events(/.*)?',
      '-allowGET=(/v[\\d.]+)?/version',
      '-allowHEAD=(/v[\\d.]+)?/_ping',
      '-allowHEAD=(/v[\\d.]+)?/events(/.*)?',
      '-allowHEAD=(/v[\\d.]+)?/version'
    ].join('\n')
  );
}

{
  const result = convert('PING=1\nEVENTS=0\nVERSION=0', 'env', { source: 'tecnativa' });
  const outputLines = lines(result.output);

  assert.deepEqual(outputLines, [
    'SP_ALLOW_GET=(/v[\\d.]+)?/_ping',
    'SP_ALLOW_HEAD=(/v[\\d.]+)?/_ping'
  ]);
  assert(!result.output.includes('"'));
}

{
  const result = convert('PING=1\nEVENTS=1\nVERSION=1', 'env', { source: 'tecnativa' });

  assert.deepEqual(lines(result.output).slice(0, 3), [
    'SP_ALLOW_GET=(/v[\\d.]+)?/_ping',
    'SP_ALLOW_GET_2=(/v[\\d.]+)?/events(/.*)?',
    'SP_ALLOW_GET_3=(/v[\\d.]+)?/version'
  ]);
}

{
  const input = onlyEnabled('tecnativa', 'CONTAINERS', { POST: '1' });
  const result = convert(input, 'command', { source: 'tecnativa' });

  assert(result.output.includes('-allowGET=(/v[\\d.]+)?/containers(/.*)?'));
  assert(result.output.includes('-allowPOST=(/v[\\d.]+)?/containers(/.*)?'));
  assert(result.output.includes('-allowPUT=(/v[\\d.]+)?/containers(/.*)?'));
  assert(result.output.includes('-allowDELETE=(/v[\\d.]+)?/containers(/.*)?'));
  assert(!result.output.includes('-allowPATCH='));
  assert(!result.output.includes('-allowOPTIONS='));
  assert(!result.output.includes('-allowCONNECT='));
  assert(!result.output.includes('-allowTRACE='));

  const pattern = result.output.match(/-allowGET=(.+)/)?.[1];
  assert(pattern);
  const anchored = new RegExp(`^${pattern}$`);
  assert(anchored.test('/containers'));
  assert(anchored.test('/v1.51/containers/example/json'));
  assert(!anchored.test('/containers-invalid'));
}

{
  const input = onlyEnabled('tecnativa', 'CONTAINERS', { POST: '1' });
  const result = convert(input, 'command', {
    source: 'tecnativa',
    extendedHaproxyCompatibility: true
  });

  assert(result.output.includes('-allowGET=(?i:(/v[\\d.]+)?/containers.*)'));
  assert(result.output.includes('-allowPATCH=(?i:(/v[\\d.]+)?/containers.*)'));
  assert(result.output.includes('-allowOPTIONS=(?i:(/v[\\d.]+)?/containers.*)'));
  assert(result.output.includes('-allowCONNECT=(?i:(/v[\\d.]+)?/containers.*)'));
  assert(result.output.includes('-allowTRACE=(?i:(/v[\\d.]+)?/containers.*)'));
  assert(result.warnings.some((warning) => warning.includes('Broader source-proxy permissions are enabled')));
}

{
  const standard = convert(onlyEnabled('tecnativa', 'PING'), 'command', { source: 'tecnativa' });
  const compatible = convert(onlyEnabled('tecnativa', 'PING'), 'command', {
    source: 'tecnativa',
    extendedHaproxyCompatibility: true
  });

  assert(standard.output.includes('-allowGET=(/v[\\d.]+)?/_ping'));
  assert(!standard.output.includes('_ping.*'));
  assert(!standard.warnings.some((warning) => warning.includes('Broader source-proxy permissions are enabled')));
  assert(compatible.output.includes('-allowGET=(?i:(/v[\\d.]+)?/_ping.*)'));
  assert(compatible.warnings.some((warning) => warning.includes('not valid Docker or Podman API endpoints')));
}

{
  const dockerPatterns: Record<string, string> = {
    ALLOW_RESTARTS: 'containers/[a-zA-Z0-9_.-]+/(stop|restart|kill)',
    ALLOW_START: 'containers/[a-zA-Z0-9_.-]+/start',
    ALLOW_STOP: 'containers/[a-zA-Z0-9_.-]+/stop',
    ALLOW_PAUSE: 'containers/[a-zA-Z0-9_.-]+/pause',
    ALLOW_UNPAUSE: 'containers/[a-zA-Z0-9_.-]+/unpause',
    AUTH: 'auth(/.*)?',
    BUILD: 'build(/.*)?',
    COMMIT: 'commit(/.*)?',
    CONFIGS: 'configs(/.*)?',
    CONTAINERS: 'containers(/.*)?',
    DISTRIBUTION: 'distribution(/.*)?',
    EVENTS: 'events(/.*)?',
    EXEC: 'exec(/.*)?',
    GRPC: 'grpc(/.*)?',
    IMAGES: 'images(/.*)?',
    INFO: 'info(/.*)?',
    NETWORKS: 'networks(/.*)?',
    NODES: 'nodes(/.*)?',
    PING: '_ping',
    PLUGINS: 'plugins(/.*)?',
    SECRETS: 'secrets(/.*)?',
    SERVICES: 'services(/.*)?',
    SESSION: 'session(/.*)?',
    SWARM: 'swarm(/.*)?',
    SYSTEM: 'system(/.*)?',
    TASKS: 'tasks(/.*)?',
    VERSION: 'version',
    VOLUMES: 'volumes(/.*)?'
  };

  assert.equal(Object.keys(dockerPatterns).length, 28);
  for (const [key, path] of Object.entries(dockerPatterns)) {
    const result = convert(onlyEnabled('tecnativa', key), 'command', { source: 'tecnativa' });
    assert(
      result.output.includes(`-allowGET=(/v[\\d.]+)?/${path}`),
      `${key} did not generate its expected GET path`
    );
  }
}

{
  const result = convert('', 'command', { source: 'linuxserver' });

  assert.equal(result.source, 'linuxserver');
  assert(result.output.includes('-allowGET=(/v[\\d.]+)?/_ping'));
  assert(result.output.includes('-allowGET=(/v[\\d.]+)?/version'));
  assert(result.output.includes('-allowGET=(/v[\\d.]+)?/libpod/_ping'));
  assert(result.output.includes('-allowGET=(/v[\\d.]+)?/libpod/version'));
}

{
  const result = convert(
    onlyEnabled('linuxserver', 'LIBPOD_CONTAINERS', { EVENTS: '1' }),
    'command',
    {
      source: 'linuxserver',
      includePodmanEndpoints: false
    }
  );

  assert(result.output.includes('-allowGET=(/v[\\d.]+)?/events(/.*)?'));
  assert(!result.output.includes('/libpod/'));
  assert(!result.enabled.some((key) => key.startsWith('LIBPOD_')));
  assert(
    result.warnings.some(
      (warning) =>
        warning.includes('Podman-specific endpoints are excluded') &&
        warning.includes('LIBPOD_CONTAINERS')
    )
  );
}

{
  const libpodPatterns: Record<string, string> = {
    LIBPOD_ALLOW_PAUSE: 'libpod/containers/[a-zA-Z0-9_.-]+/pause',
    LIBPOD_ALLOW_POD_PAUSE: 'libpod/pods/[a-zA-Z0-9_.-]+/pause',
    LIBPOD_ALLOW_POD_RESTARTS: 'libpod/pods/[a-zA-Z0-9_.-]+/(stop|restart|kill)',
    LIBPOD_ALLOW_POD_START: 'libpod/pods/[a-zA-Z0-9_.-]+/start',
    LIBPOD_ALLOW_POD_STOP: 'libpod/pods/[a-zA-Z0-9_.-]+/stop',
    LIBPOD_ALLOW_POD_UNPAUSE: 'libpod/pods/[a-zA-Z0-9_.-]+/unpause',
    LIBPOD_ALLOW_RESTARTS: 'libpod/containers/[a-zA-Z0-9_.-]+/(stop|restart|kill)',
    LIBPOD_ALLOW_START: 'libpod/containers/[a-zA-Z0-9_.-]+/start',
    LIBPOD_ALLOW_STOP: 'libpod/containers/[a-zA-Z0-9_.-]+/stop',
    LIBPOD_ALLOW_UNPAUSE: 'libpod/containers/[a-zA-Z0-9_.-]+/unpause',
    LIBPOD_CONTAINERS: 'libpod/containers(/.*)?',
    LIBPOD_EVENTS: 'libpod/events(/.*)?',
    LIBPOD_EXEC: 'libpod/exec(/.*)?',
    LIBPOD_GENERATE: 'libpod/generate(/.*)?',
    LIBPOD_IMAGES: 'libpod/images(/.*)?',
    LIBPOD_INFO: 'libpod/info(/.*)?',
    LIBPOD_MANIFESTS: 'libpod/manifests(/.*)?',
    LIBPOD_NETWORKS: 'libpod/networks(/.*)?',
    LIBPOD_PING: 'libpod/_ping',
    LIBPOD_PLAY: 'libpod/play(/.*)?',
    LIBPOD_PODS: 'libpod/pods(/.*)?',
    LIBPOD_SECRETS: 'libpod/secrets(/.*)?',
    LIBPOD_SYSTEM: 'libpod/system(/.*)?',
    LIBPOD_VERSION: 'libpod/version',
    LIBPOD_VOLUMES: 'libpod/volumes(/.*)?'
  };

  assert.equal(Object.keys(libpodPatterns).length, 25);
  for (const [key, path] of Object.entries(libpodPatterns)) {
    const result = convert(onlyEnabled('linuxserver', key), 'command', { source: 'linuxserver' });
    assert(
      result.output.includes(`-allowGET=(/v[\\d.]+)?/${path}`),
      `${key} did not generate its expected GET path`
    );
  }
}

{
  const linuxAction = convert(onlyEnabled('linuxserver', 'ALLOW_START'), 'command', {
    source: 'linuxserver'
  });
  const tecnativaAction = convert(onlyEnabled('tecnativa', 'ALLOW_START'), 'command', {
    source: 'tecnativa'
  });

  assert(linuxAction.output.includes('-allowPOST=(/v[\\d.]+)?/containers/[a-zA-Z0-9_.-]+/start'));
  assert(linuxAction.output.includes('-allowPUT=(/v[\\d.]+)?/containers/[a-zA-Z0-9_.-]+/start'));
  assert(linuxAction.output.includes('-allowDELETE=(/v[\\d.]+)?/containers/[a-zA-Z0-9_.-]+/start'));
  assert(!tecnativaAction.output.includes('-allowPOST='));
}

{
  const result = convert(onlyEnabled('linuxserver', 'LIBPOD_CONTAINERS'), 'command', {
    source: 'linuxserver'
  });

  assert(!result.output.includes('-allowPOST='));
}

{
  const result = convert('LIBPOD_CONTAINERS=1\nEVENTS=0\nPING=0\nVERSION=0', 'command', {
    source: 'tecnativa'
  });

  assert(!result.output.includes('/libpod/containers'));
  assert(result.warnings.some((warning) => warning.includes('LinuxServer-only variable')));
}

{
  const truthy = ['1', 'true', 'yes', 'on', 'enable', 'enabled', 'TRUE', '"yes"'];
  const falsy = ['0', 'false', 'no', 'off', 'disable', 'disabled', 'FALSE', "'no'"];

  for (const value of truthy) {
    const result = convert(`PING=${value}\nEVENTS=0\nVERSION=0`, 'command', { source: 'tecnativa' });
    assert(result.output.includes('/_ping'), `${value} should be truthy`);
  }
  for (const value of falsy) {
    const result = convert(`PING=${value}\nEVENTS=0\nVERSION=0`, 'command', { source: 'tecnativa' });
    assert(!result.output.includes('/_ping'), `${value} should be falsy`);
  }
}

{
  const result = convert('EVENTS=\nPING=0\nVERSION=0', 'env', { source: 'tecnativa' });

  assert(result.warnings.some((warning) => warning.includes('Invalid boolean value for EVENTS')));
  assert(!result.output.includes('events'));
  assert(result.warnings.some((warning) => warning.includes('block all proxied API requests')));
}

{
  const result = convert('CONTAINERS=maybe\nUNKNOWN=1\nEVENTS=0\nPING=0\nVERSION=0', 'env', {
    source: 'tecnativa'
  });

  assert(result.warnings.some((warning) => warning.includes('Invalid boolean value for CONTAINERS')));
  assert(result.warnings.some((warning) => warning.includes('Unknown docker-socket-proxy variable ignored: UNKNOWN')));
  assert(!result.output.includes('containers'));
}

{
  const result = convert('CONTAINERS=0\ncontainers=1\nEVENTS=0\nPING=0\nVERSION=0', 'env', {
    source: 'tecnativa'
  });

  assert(result.output.includes('SP_ALLOW_GET=(/v[\\d.]+)?/containers(/.*)?'));
  assert(result.warnings.some((warning) => warning.includes('Duplicate docker-socket-proxy variable found: CONTAINERS')));
  assert(result.warnings.some((warning) => warning.includes('Using the last value')));
}

{
  const result = convert(`
services:
  proxy:
    image: tecnativa/docker-socket-proxy
    environment:
      - CONTAINERS=1
      this is not valid env
      /var/run/docker.sock:/var/run/docker.sock
`, 'env', { source: 'tecnativa' });

  assert(result.warnings.some((warning) => warning.includes('Invalid input line ignored: "this is not valid env"')));
  assert(!result.warnings.some((warning) => warning.includes('services:')));
  assert(!result.warnings.some((warning) => warning.includes('image:')));
  assert(!result.warnings.some((warning) => warning.includes('/var/run/docker.sock')));
}

{
  const mappings: Record<string, string | undefined> = {
    debug: 'DEBUG',
    info: 'INFO',
    notice: 'INFO',
    warning: 'WARN',
    warn: 'WARN',
    err: 'ERROR',
    crit: 'ERROR',
    alert: 'ERROR',
    emerg: 'ERROR',
    invalid: undefined
  };

  for (const [input, expected] of Object.entries(mappings)) {
    const result = convert(`LOG_LEVEL=${input}\nEVENTS=0\nPING=0\nVERSION=0`, 'env', {
      source: 'tecnativa'
    });
    if (expected) {
      assert(result.output.includes(`SP_LOGLEVEL=${expected}`), `${input} should map to ${expected}`);
    } else {
      assert(!result.output.includes('SP_LOGLEVEL='));
      assert(result.warnings.some((warning) => warning.includes('Unsupported LOG_LEVEL')));
    }
  }
}

{
  const result = convert(
    'SOCKET_PATH=/run/podman/podman.sock\nTZ=Europe/Berlin\nBIND_CONFIG=:2375\nEVENTS=0\nPING=0\nVERSION=0',
    'command',
    { source: 'linuxserver' }
  );

  assert(result.output.includes('-socketpath=/run/podman/podman.sock'));
  assert(result.warnings.some((warning) => warning.includes('TZ has no equivalent')));
  assert(result.warnings.some((warning) => warning.includes('BIND_CONFIG is not converted')));
}

{
  const result = convert('DISABLE_IPV6=0\nPING=1\nEVENTS=0\nVERSION=0', 'env', {
    source: 'tecnativa',
    networkListenCompatibility: true
  });

  assert(lines(result.output).includes('SP_LISTENIP=0.0.0.0'));
  assert(lines(result.output).includes('SP_ALLOWFROM=0.0.0.0/0'));
  assert(result.warnings.some((warning) => warning.includes('DISABLE_IPV6=0 is not reproduced')));
}

{
  const result = convert(onlyEnabled('linuxserver', 'LIBPOD_PING'), 'labels', {
    source: 'linuxserver'
  });

  assert.equal(lines(result.output)[0], 'labels:');
  assert(result.output.includes("  - 'socket-proxy.allow.get=(/v[\\d.]+)?/libpod/_ping'"));
  assert(result.output.includes("  - 'socket-proxy.allow.head=(/v[\\d.]+)?/libpod/_ping'"));
  assert(result.warnings.some((warning) => warning.includes('SP_PROXYCONTAINERNAME')));
}

{
  const tecnativa = allLegacyOptionsInput('tecnativa');
  const linuxserver = allLegacyOptionsInput('linuxserver');
  const tecnativaDefaults = defaultLegacyInputForSource('tecnativa');
  const linuxserverDefaults = defaultLegacyInputForSource('linuxserver');

  assert(!tecnativa.includes('LIBPOD_'));
  assert(linuxserver.includes('LIBPOD_PING=1'));
  assert(linuxserver.includes('LIBPOD_VERSION=1'));
  assert.equal(linuxserver.split('\n').filter((line) => line.startsWith('LIBPOD_')).length, 25);
  assert.equal(defaultLegacyInput, tecnativaDefaults);
  assert.equal(tecnativaDefaults, 'EVENTS=1\nPING=1\nVERSION=1');
  assert.equal(
    linuxserverDefaults,
    'EVENTS=1\nPING=1\nVERSION=1\nLIBPOD_PING=1\nLIBPOD_VERSION=1'
  );
}
