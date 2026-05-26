<script lang="ts">
  import { convert, type OutputMode } from './converter';

  let input = $state(`CONTAINERS=1
EVENTS=1
PING=1
VERSION=1
POST=0`);
  let mode = $state<OutputMode>('command');

  let result = $derived(convert(input, mode));

  async function copyOutput() {
    await navigator.clipboard.writeText(result.output);
  }
</script>

<main class="shell">
  <header>
    <div>
      <p class="eyebrow">socket proxy configuration converter</p>
      <h1>docker-socket-proxy → wollomatic/socket-proxy</h1>
      <p class="lead">Paste the docker-socket-proxy configuration. The matching wollomatic/socket-proxy regexp allowlist is generated according to the input.</p>
    </div>
    <div class="mode" aria-label="Output format">
      <button class:active={mode === 'command'} onclick={() => (mode = 'command')}>Command line</button>
      <button class:active={mode === 'env'} onclick={() => (mode = 'env')}>ENV</button>
      <button class:active={mode === 'labels'} onclick={() => (mode = 'labels')}>Docker labels</button>
    </div>
  </header>

  <section class="grid">
    <label class="panel">
      <div class="panel-head">
        <span>docker-socket-proxy configuration</span>
      </div>
      <textarea bind:value={input} spellcheck="false" placeholder="CONTAINERS=1&#10;EVENTS=1&#10;PING=1&#10;VERSION=1&#10;POST=0"></textarea>
    </label>

    <section class="panel">
      <div class="panel-head">
        <span>wollomatic/socket-proxy configuration</span>
        <button class="copy" onclick={copyOutput}>Copy</button>
      </div>
      <pre>{result.output}</pre>
    </section>
  </section>

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

  <footer>
    Enabled: {result.enabled.join(', ') || 'none'}
  </footer>

</main>
