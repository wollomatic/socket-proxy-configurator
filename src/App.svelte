<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { convert, type OutputMode } from './converter';

  const appVersion = __APP_VERSION__;
  const defaultInput = `EVENTS=1
PING=1
VERSION=1`;

  let input = $state(defaultInput);
  let mode = $state<OutputMode>('command');
  let inputElement: HTMLTextAreaElement | undefined = $state();
  let privacyCloseButton: HTMLButtonElement | undefined = $state();
  let privacyDialogElement: HTMLDivElement | undefined = $state();
  let privacyDialogTrigger: HTMLElement | undefined = $state();
  let privacyDialogOpen = $state(false);
  let networkListenCompatibility = $state(false);
  let inputActionMessage = $state('');
  let outputActionMessage = $state('');

  let networkListenCompatibilityEnabled = $derived(mode !== 'labels' && networkListenCompatibility);
  let result = $derived(convert(input, mode, { networkListenCompatibility: networkListenCompatibilityEnabled }));
  let inputDescription = $derived(inputActionMessage ? 'input-help input-status' : 'input-help');

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

  $effect(() => {
    input;
    mode;
    networkListenCompatibilityEnabled;
    outputActionMessage = '';
  });

  async function copyOutput() {
    try {
      await navigator.clipboard.writeText(result.output);
      outputActionMessage = 'Generated configuration copied to the clipboard.';
    } catch {
      outputActionMessage = 'Clipboard access was blocked. Select the generated configuration and copy it manually.';
    }
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

  async function openPrivacyDialog(event: MouseEvent) {
    privacyDialogTrigger = event.currentTarget instanceof HTMLElement ? event.currentTarget : undefined;
    privacyDialogOpen = true;
    await tick();
    privacyCloseButton?.focus();
  }

  async function closePrivacyDialog() {
    privacyDialogOpen = false;
    await tick();
    privacyDialogTrigger?.focus();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && privacyDialogOpen) {
      event.preventDefault();
      closePrivacyDialog();
      return;
    }

    if (event.key === 'Tab' && privacyDialogOpen && privacyDialogElement) {
      const focusableElements = Array.from(
        privacyDialogElement.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );

      if (focusableElements.length === 0) {
        event.preventDefault();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<main class="shell">
  <header>
    <div>
      <p class="eyebrow">wollomatic/socket-proxy configuration tool</p>
      <h1>Socket Proxy Configuration Converter</h1>
      <p class="lead">Paste the docker-socket-proxy configuration. The matching regexp allowlist for <a href="https://github.com/wollomatic/socket-proxy">wollomatic/socket-proxy</a> will be generated based on the input. The generated configuration is compatible with wollomatic/socket-proxy 1.12.0 and newer. <a href="https://github.com/wollomatic/socket-proxy-configurator/blob/main/README.md">More information in the README.</a>
        <br /><br />
        All data is processed locally in your browser and never leaves your computer.</p>
    </div>
  </header>

  <div class="controls">
    <label class="compatibility" class:disabled={mode === 'labels'}>
      <input type="checkbox" bind:checked={networkListenCompatibility} disabled={mode === 'labels'} />
      <span>Include docker-socket-proxy network listener compatibility settings</span>
    </label>
    <div class="mode" aria-label="Output format">
      <button type="button" class:active={mode === 'command'} aria-pressed={mode === 'command'} onclick={() => (mode = 'command')}>Command line</button>
      <button type="button" class:active={mode === 'env'} aria-pressed={mode === 'env'} onclick={() => (mode = 'env')}>ENV</button>
      <button type="button" class:active={mode === 'labels'} aria-pressed={mode === 'labels'} onclick={() => (mode = 'labels')}>Docker labels</button>
    </div>
  </div>

  {#if result.warnings.length > 0}
    <aside class="warnings" aria-labelledby="warnings-title" aria-live="polite">
      <strong id="warnings-title">Warnings</strong>
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
        <h2 id="input-title">docker-socket-proxy configuration</h2>
        <div class="panel-actions">
          <button class="panel-button" type="button" onclick={resetInput}>Reset</button>
          <button class="panel-button" type="button" onclick={pasteInput}>Paste</button>
        </div>
      </div>
      <p id="input-help" class="sr-only">Paste docker-socket-proxy environment variables, docker-compose snippets, or env file content.</p>
      <textarea bind:this={inputElement} bind:value={input} aria-labelledby="input-title" aria-describedby={inputDescription} spellcheck="false" placeholder="paste content here"></textarea>
      {#if inputActionMessage}
        <p id="input-status" class="panel-message" role="status">{inputActionMessage}</p>
      {/if}
    </section>

    <section class="panel" aria-labelledby="output-title">
      <div class="panel-head">
        <h2 id="output-title">wollomatic/socket-proxy configuration</h2>
        <button class="panel-button" type="button" onclick={copyOutput}>Copy</button>
      </div>
      <p id="output-help" class="sr-only">Generated wollomatic/socket-proxy configuration. This field updates automatically when the input or output format changes.</p>
      <textarea value={result.output} aria-labelledby="output-title" aria-describedby="output-help output-status" readonly spellcheck="false"></textarea>
      <p id="output-status" class="panel-message" class:empty={!outputActionMessage} role="status" aria-live="polite">{outputActionMessage}</p>
    </section>
  </section>

  <footer>
    <br />
    Enabled: {result.enabled.join(', ') || 'none'}<br />
    <br />
    This tool generates configuration output automatically based on the provided input. The generated configuration and code snippets must be reviewed, validated, and tested by a human before being used in production environments.<br />
    No guarantee is given regarding correctness, completeness, security, compatibility, or fitness for a particular purpose. Use at your own risk.<br />
    The authors and contributors assume no liability for any damage, data loss, security issues, downtime, or other consequences resulting from the use of the generated output.<br />
    <br />
    <a href="https://github.com/wollomatic/socket-proxy-configurator/blob/main/LICENSE">MIT license</a> | <a href="https://github.com/wollomatic/socket-proxy-configurator">GitHub</a> | <a href="https://mein.online-impressum.de/wollomatic/">Imprint</a> | <button class="footer-link" type="button" onclick={openPrivacyDialog}>Data protection</button><br />
    <br />
    wollomatic/socket-proxy-configurator version {appVersion}
  </footer>

  {#if privacyDialogOpen}
    <div class="dialog-layer">
      <button class="dialog-backdrop" type="button" tabindex="-1" aria-hidden="true" onclick={closePrivacyDialog}></button>
      <div
        bind:this={privacyDialogElement}
        class="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="privacy-title"
        aria-describedby="privacy-description"
      >
        <div class="dialog-head">
          <h2 id="privacy-title">Data protection</h2>
          <button class="dialog-close" type="button" aria-label="Close data protection information" bind:this={privacyCloseButton} onclick={closePrivacyDialog}>Close</button>
        </div>
        <p id="privacy-description">
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
