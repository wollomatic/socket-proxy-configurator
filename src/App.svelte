<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { convert, type OutputMode } from './converter';

  const defaultInput = `CONTAINERS=1
EVENTS=1
PING=1
VERSION=1
POST=0`;

  let input = $state(defaultInput);
  let mode = $state<OutputMode>('command');
  let inputElement: HTMLTextAreaElement | undefined = $state();
  let privacyCloseButton: HTMLButtonElement | undefined = $state();
  let privacyDialogOpen = $state(false);
  let networkListenCompatibility = $state(false);
  let inputActionMessage = $state('');

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

  function resetInput() {
    input = defaultInput;
    inputActionMessage = '';
    inputElement?.focus();
  }

  async function pasteInput() {
    try {
      input = await navigator.clipboard.readText();
      inputActionMessage = '';
      await tick();
    } catch {
      inputActionMessage = 'Clipboard access was blocked. Focus the input and paste with Ctrl+V or the browser menu.';
    }
    inputElement?.focus();
  }

  async function openPrivacyDialog() {
    privacyDialogOpen = true;
    await tick();
    privacyCloseButton?.focus();
  }

  function closePrivacyDialog() {
    privacyDialogOpen = false;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && privacyDialogOpen) {
      closePrivacyDialog();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

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
    <section class="panel" aria-labelledby="input-title">
      <div class="panel-head">
        <span id="input-title">docker-socket-proxy configuration</span>
        <div class="panel-actions">
          <button class="panel-button" type="button" onclick={resetInput}>Reset</button>
          <button class="panel-button" type="button" onclick={pasteInput}>Paste</button>
        </div>
      </div>
      <textarea bind:this={inputElement} bind:value={input} aria-labelledby="input-title" spellcheck="false" placeholder="CONTAINERS=1&#10;EVENTS=1&#10;PING=1&#10;VERSION=1&#10;POST=0"></textarea>
      {#if inputActionMessage}
        <p class="panel-message">{inputActionMessage}</p>
      {/if}
    </section>

    <section class="panel">
      <div class="panel-head">
        <span id="output-title">wollomatic/socket-proxy configuration</span>
        <button class="panel-button" type="button" onclick={copyOutput}>Copy</button>
      </div>
      <textarea value={result.output} aria-labelledby="output-title" readonly spellcheck="false"></textarea>
    </section>
  </section>

  <footer>
    Enabled: {result.enabled.join(', ') || 'none'}<br />
    <br />
    This tool generates configuration output automatically based on the provided input. The generated configuration and code snippets must be reviewed, validated, and tested by a human before being used in production environments.<br />
    No guarantee is given regarding correctness, completeness, security, compatibility, or fitness for a particular purpose. Use at your own risk.<br />
    The authors and contributors assume no liability for any damage, data loss, security issues, downtime, or other consequences resulting from the use of the generated output.<br />
    <br />
    <a href="https://github.com/wollomatic/socket-proxy-configurator/blob/main/LICENSE">MIT license</a> | <a href="https://github.com/wollomatic/docker-socket-proxy-converter">GitHub</a> | <a href="https://mein.online-impressum.de/wollomatic/">Imprint</a> | <button class="footer-link" onclick={openPrivacyDialog}>Data protection</button>
  </footer>

  {#if privacyDialogOpen}
    <div class="dialog-layer">
      <button class="dialog-backdrop" type="button" aria-label="Close data protection information" onclick={closePrivacyDialog}></button>
      <div
        class="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="privacy-title"
      >
        <div class="dialog-head">
          <h2 id="privacy-title">Data protection</h2>
          <button class="dialog-close" aria-label="Close data protection information" bind:this={privacyCloseButton} onclick={closePrivacyDialog}>Close</button>
        </div>
        <p>
          All data entered into this form is processed locally in your browser and is not sent to the server.
          This website does not use cookies.
        </p>
        <p>
          The web server only stores access log data containing the date and time of the request, the user agent,
          and the referer if one is provided by the browser. IP addresses are not stored.
        </p>
      </div>
    </div>
  {/if}
</main>
