<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { convert, type OutputMode } from './converter';

  let input = $state(`CONTAINERS=1
EVENTS=1
PING=1
VERSION=1
POST=0`);
  let mode = $state<OutputMode>('command');
  let inputElement: HTMLTextAreaElement | undefined = $state();
  let networkListenCompatibility = $state(false);

  let networkListenCompatibilityEnabled = $derived(mode !== 'labels' && networkListenCompatibility);
  let result = $derived(convert(input, mode, { networkListenCompatibility: networkListenCompatibilityEnabled }));

  function syncRestoredInput() {
    if (inputElement && inputElement.value !== input) {
      input = inputElement.value;
    }
  }

  onMount(() => {
    const syncAfterBrowserRestore = () => {
      void tick().then(() => {
        syncRestoredInput();
        requestAnimationFrame(syncRestoredInput);
      });
    };

    syncAfterBrowserRestore();
    window.addEventListener('pageshow', syncAfterBrowserRestore);

    return () => {
      window.removeEventListener('pageshow', syncAfterBrowserRestore);
    };
  });

  async function copyOutput() {
    await navigator.clipboard.writeText(result.output);
  }
</script>

<main class="shell">
  <header>
    <div>
      <p class="eyebrow">wollomatic/socket-proxy configuration tool</p>
      <h1>Socket Proxy Configuration Converter</h1>
      <p class="lead">Paste the docker-socket-proxy configuration. The matching wollomatic/socket-proxy regexp allowlist is generated according to the input.</p>
    </div>
  </header>

  <div class="controls">
    <label class="compatibility" class:disabled={mode === 'labels'}>
      <input type="checkbox" bind:checked={networkListenCompatibility} disabled={mode === 'labels'} />
      <span>Include docker-socket-proxy network listener compatibility settings</span>
    </label>
    <div class="mode" aria-label="Output format">
      <button class:active={mode === 'command'} onclick={() => (mode = 'command')}>Command line</button>
      <button class:active={mode === 'env'} onclick={() => (mode = 'env')}>ENV</button>
      <button class:active={mode === 'labels'} onclick={() => (mode = 'labels')}>Docker labels</button>
    </div>
  </div>

  {#if result.warnings.length > 0}
    <aside class="warnings">
      <strong>Warnings</strong>
      <ul>
        {#each result.warnings as warning}
          <li>{warning}</li>
        {/each}
      </ul>
    </aside>
  {/if}

  <section class="grid">
    <label class="panel">
      <div class="panel-head">
        <span>docker-socket-proxy configuration</span>
      </div>
      <textarea bind:this={inputElement} bind:value={input} spellcheck="false" placeholder="CONTAINERS=1&#10;EVENTS=1&#10;PING=1&#10;VERSION=1&#10;POST=0"></textarea>
    </label>

    <section class="panel">
      <div class="panel-head">
        <span>wollomatic/socket-proxy configuration</span>
        <button class="copy" onclick={copyOutput}>Copy</button>
      </div>
      <pre>{result.output}</pre>
    </section>
  </section>

  <footer>
    Enabled: {result.enabled.join(', ') || 'none'}<br />
    <br />
    This tool generates configuration output automatically based on the provided input. The generated configuration and code snippets must be reviewed, validated, and tested by a human before being used in production environments.<br />
    No guarantee is given regarding correctness, completeness, security, compatibility, or fitness for a particular purpose. Use at your own risk.<br />
    The authors and contributors assume no liability for any damage, data loss, security issues, downtime, or other consequences resulting from the use of the generated output.<br />
    <br />
    <a href="https://github.com/wollomatic/docker-socket-proxy-converter">GitHub</a> | <a href="https://mein.online-impressum.de/wollomatic/">Imprint</a> | <a href="https://github.com/wollomatic/socket-proxy-configurator/blob/main/LICENSE">MIT license</a>
  </footer>

</main>
