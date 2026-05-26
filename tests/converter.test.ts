import assert from 'node:assert/strict';
import { convert, parseLegacyInput } from '../src/converter.ts';

function lines(output: string): string[] {
  return output.split('\n');
}

{
  const parsed = parseLegacyInput(`
services:
  proxy:
    image: tecnativa/docker-socket-proxy
    environment:
      - "containers=yes"
      ping: false
      VERSION: "1" # keep version
      LOG_LEVEL: debug
`);

  assert.equal(parsed.CONTAINERS, 'yes');
  assert.equal(parsed.PING, 'false');
  assert.equal(parsed.VERSION, '1');
  assert.equal(parsed.LOG_LEVEL, 'debug');
  assert.equal(parsed.IMAGE, undefined);
}

{
  const result = convert('PING=1\nEVENTS=0\nVERSION=0', 'env');
  const outputLines = lines(result.output);

  assert(!outputLines.some((line) => line.startsWith('SP_LISTENIP=')));
  assert(!outputLines.some((line) => line.startsWith('SP_ALLOWFROM=')));
  assert(outputLines.includes('SP_ALLOW_HEAD="/_ping"'));
  assert(outputLines.includes('SP_ALLOW_HEAD_2="/v[\\\\d.]+/_ping"'));
  assert(outputLines.includes('SP_ALLOW_GET="/_ping"'));
  assert(!outputLines.some((line) => line.startsWith('SP_ALLOW_POST=')));
}

{
  const result = convert('PING=1\nEVENTS=0\nVERSION=0', 'env', {
    networkListenCompatibility: true
  });
  const outputLines = lines(result.output);

  assert.equal(outputLines[0], 'SP_LISTENIP="0.0.0.0"');
  assert.equal(outputLines[1], 'SP_ALLOWFROM="0.0.0.0/0"');
  assert(result.warnings.some((warning) => warning.includes('uses listenip=0.0.0.0 and allowfrom=0.0.0.0/0')));
}

{
  const result = convert('ALLOW_START=1\nEVENTS=0\nPING=0\nVERSION=0', 'command');

  assert(
    result.output.includes(
      "- '-allowGET=(/v[\\d.]+)?/containers/[a-zA-Z0-9_.-]+/start.*'"
    )
  );
  assert(
    result.output.includes(
      "- '-allowHEAD=(/v[\\d.]+)?/containers/[a-zA-Z0-9_.-]+/start.*'"
    )
  );
}

{
  const result = convert('CONTAINERS=1\nPOST=1\nEVENTS=0\nPING=0\nVERSION=0', 'command');

  assert(result.output.includes("- '-allowPOST=(/v[\\d.]+)?/containers.*'"));
  assert(result.output.includes("- '-allowPUT=(/v[\\d.]+)?/containers.*'"));
  assert(result.output.includes("- '-allowPATCH=(/v[\\d.]+)?/containers.*'"));
  assert(result.output.includes("- '-allowDELETE=(/v[\\d.]+)?/containers.*'"));
  assert(result.output.includes("- '-allowOPTIONS=(/v[\\d.]+)?/containers.*'"));
  assert(result.output.includes("- '-allowCONNECT=(/v[\\d.]+)?/containers.*'"));
  assert(result.output.includes("- '-allowTRACE=(/v[\\d.]+)?/containers.*'"));
}

{
  const result = convert('PING=1\nEVENTS=0\nVERSION=0\nPOST=0', 'labels');
  const outputLines = lines(result.output);

  assert.equal(outputLines[0], 'labels:');
  assert(outputLines.includes("  - 'socket-proxy.allow.get=/_ping'"));
  assert(outputLines.includes("  - 'socket-proxy.allow.get.1=/v[\\d.]+/_ping'"));
  assert(outputLines.includes("  - 'socket-proxy.allow.head=/_ping'"));
  assert(outputLines.includes("  - 'socket-proxy.allow.head.1=/v[\\d.]+/_ping'"));
  assert(!result.output.includes('SP_ALLOWFROM'));
  assert(!result.output.includes('-allowfrom'));
  assert(!result.warnings.some((warning) => warning.includes('Generated allowfrom=')));
  assert(result.warnings.some((warning) => warning.includes('SP_PROXYCONTAINERNAME')));
}

{
  const result = convert('CONTAINERS=maybe\nUNKNOWN=1\nSP_ALLOWFROM=traefik\nSP_LISTENIP=192.0.2.10', 'env');

  assert(result.warnings.some((warning) => warning.includes('Invalid boolean value for CONTAINERS')));
  assert(!result.output.includes('containers'));
  assert(result.warnings.some((warning) => warning.includes('Unknown docker-socket-proxy variable ignored: UNKNOWN')));
  assert(result.output.includes('SP_ALLOWFROM="traefik"'));
  assert(result.output.includes('SP_LISTENIP="192.0.2.10"'));
  assert(!result.warnings.some((warning) => warning.includes('Generated allowfrom=')));
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
`, 'env');

  assert(result.warnings.some((warning) => warning.includes('Invalid input line ignored: "this is not valid env"')));
  assert(!result.warnings.some((warning) => warning.includes('services:')));
  assert(!result.warnings.some((warning) => warning.includes('image:')));
  assert(!result.warnings.some((warning) => warning.includes('/var/run/docker.sock')));
}

{
  const result = convert('EVENTS=maybe\nPING=0\nVERSION=0\nSP_ALLOWFROM=traefik', 'env');

  assert(result.warnings.some((warning) => warning.includes('Invalid boolean value for EVENTS')));
  assert(!result.output.includes('events'));
  assert(result.warnings.some((warning) => warning.includes('block all Docker requests')));
}
