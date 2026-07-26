<script lang="ts">
  import { onMount, tick } from 'svelte';
  import {
    allLegacyOptionsInput,
    convert,
    defaultLegacyInput,
    defaultLegacyInputForSource,
    type OutputMode,
    type SourceProfile
  } from './converter';

  const appVersion = __APP_VERSION__;
  const buildDate = __BUILD_DATE__;

  let input = $state(defaultLegacyInput);
  let mode = $state<OutputMode>('command');
  let source = $state<SourceProfile>('tecnativa');
  let inputElement: HTMLTextAreaElement | undefined = $state();
  let outputElement: HTMLTextAreaElement | undefined = $state();
  let privacyCloseButton: HTMLButtonElement | undefined = $state();
  let privacyDialogElement: HTMLDivElement | undefined = $state();
  let privacyDialogTrigger: HTMLElement | undefined = $state();
  let privacyDialogOpen = $state(false);
  let networkInfoCloseButton: HTMLButtonElement | undefined = $state();
  let networkInfoDialogElement: HTMLDivElement | undefined = $state();
  let networkInfoDialogTrigger: HTMLElement | undefined = $state();
  let networkInfoDialogOpen = $state(false);
  let methodInfoCloseButton: HTMLButtonElement | undefined = $state();
  let methodInfoDialogElement: HTMLDivElement | undefined = $state();
  let methodInfoDialogTrigger: HTMLElement | undefined = $state();
  let methodInfoDialogOpen = $state(false);
  let networkListenCompatibility = $state(false);
  let extendedHaproxyCompatibility = $state(false);
  let includePodmanEndpoints = $state(true);
  let inputActionMessage = $state('');
  let outputActionMessage = $state('');

  let networkListenCompatibilityEnabled = $derived(mode !== 'labels' && networkListenCompatibility);
  let result = $derived(convert(input, mode, {
    source,
    networkListenCompatibility: networkListenCompatibilityEnabled,
    extendedHaproxyCompatibility,
    includePodmanEndpoints
  }));
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
    source;
    networkListenCompatibilityEnabled;
    extendedHaproxyCompatibility;
    includePodmanEndpoints;
    outputActionMessage = '';
  });

  async function copyOutput() {
    const hasSelectedOutput = outputElement && outputElement.selectionStart !== outputElement.selectionEnd;
    const selectedOutput = hasSelectedOutput
      ? outputElement.value.slice(outputElement.selectionStart, outputElement.selectionEnd)
      : result.output;

    try {
      await navigator.clipboard.writeText(selectedOutput);
      outputActionMessage = hasSelectedOutput
        ? 'Selection copied to the clipboard.'
        : 'Generated configuration copied to the clipboard.';
    } catch {
      outputActionMessage = 'Clipboard access was blocked. Select the generated configuration and copy it manually.';
    }
  }

  function resetInput() {
    input = defaultLegacyInputForSource(source);
    inputActionMessage = '';
    inputElement?.focus();
  }

  function selectSource(nextSource: SourceProfile) {
    const showsCurrentDefault = input.trim() === defaultLegacyInputForSource(source);
    source = nextSource;
    if (showsCurrentDefault) {
      input = defaultLegacyInputForSource(nextSource);
    }
    inputActionMessage = '';
  }

  function insertAllOptions() {
    input = allLegacyOptionsInput(source);
    inputActionMessage = '';
    inputElement?.focus();
  }

  function selectOutput() {
    outputElement?.focus();
    outputElement?.select();
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

  async function openNetworkInfoDialog(event: MouseEvent) {
    networkInfoDialogTrigger = event.currentTarget instanceof HTMLElement ? event.currentTarget : undefined;
    networkInfoDialogOpen = true;
    await tick();
    networkInfoCloseButton?.focus();
  }

  async function closeNetworkInfoDialog() {
    networkInfoDialogOpen = false;
    await tick();
    networkInfoDialogTrigger?.focus();
  }

  async function openMethodInfoDialog(event: MouseEvent) {
    methodInfoDialogTrigger = event.currentTarget instanceof HTMLElement ? event.currentTarget : undefined;
    methodInfoDialogOpen = true;
    await tick();
    methodInfoCloseButton?.focus();
  }

  async function closeMethodInfoDialog() {
    methodInfoDialogOpen = false;
    await tick();
    methodInfoDialogTrigger?.focus();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && privacyDialogOpen) {
      event.preventDefault();
      closePrivacyDialog();
      return;
    }

    if (event.key === 'Escape' && networkInfoDialogOpen) {
      event.preventDefault();
      closeNetworkInfoDialog();
      return;
    }

    if (event.key === 'Escape' && methodInfoDialogOpen) {
      event.preventDefault();
      closeMethodInfoDialog();
      return;
    }

    const activeDialogElement = privacyDialogOpen
      ? privacyDialogElement
      : networkInfoDialogOpen
        ? networkInfoDialogElement
        : methodInfoDialogOpen
          ? methodInfoDialogElement
          : undefined;

    if (event.key === 'Tab' && activeDialogElement) {
      const focusableElements = Array.from(
        activeDialogElement.querySelectorAll<HTMLElement>(
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
      <p class="lead">Paste the configuration that is valid for <a href="https://github.com/Tecnativa/docker-socket-proxy">tecnativa/docker-socket-proxy</a> or <a href="https://github.com/linuxserver/docker-socket-proxy">linuxserver/docker-socket-proxy</a> into the left panel. The matching regexp allowlist for <a href="https://github.com/wollomatic/socket-proxy">wollomatic/socket-proxy</a> will be generated from that input. The generated configuration is compatible with wollomatic/socket-proxy 1.12.0 and newer. <a href="https://github.com/wollomatic/socket-proxy-configurator/blob/main/README.md">More information in the README.</a>
        <br /><br />
        All data is processed locally in your browser and never leaves your computer.</p>
    </div>
  </header>

  <div class="controls">
    <div class="compatibility-options">
      <div class="compatibility-control">
        <label class="compatibility" class:disabled={mode === 'labels'}>
          <input type="checkbox" bind:checked={networkListenCompatibility} disabled={mode === 'labels'} />
          <span>Include docker-socket-proxy network listener compatibility settings</span>
        </label>
        <button
          class="info-button"
          type="button"
          aria-label="Show network listener compatibility information"
          aria-haspopup="dialog"
          onclick={openNetworkInfoDialog}
        >i</button>
      </div>
      <div class="compatibility-control">
        <label class="compatibility">
          <input type="checkbox" bind:checked={extendedHaproxyCompatibility} />
          <span>Include source-proxy permissions beyond Docker API requirements</span>
        </label>
        <button
          class="info-button"
          type="button"
          aria-label="Show broader source-proxy permissions information"
          aria-haspopup="dialog"
          onclick={openMethodInfoDialog}
        >i</button>
      </div>
      <div class="compatibility-control">
        <label class="compatibility" class:disabled={source !== 'linuxserver'}>
          <input
            type="checkbox"
            bind:checked={includePodmanEndpoints}
            disabled={source !== 'linuxserver'}
          />
          <span>Include Podman-specific endpoints (LinuxServer only)</span>
        </label>
      </div>
    </div>
    <div class="selector-options">
      <div class="selector-row">
        <span class="selector-label" id="source-selector-label">Source proxy</span>
        <div class="mode selector-mode source-mode" role="group" aria-labelledby="source-selector-label">
          <button
            type="button"
            class:active={source === 'tecnativa'}
            aria-pressed={source === 'tecnativa'}
            onclick={() => selectSource('tecnativa')}
          >Tecnativa</button>
          <button
            type="button"
            class:active={source === 'linuxserver'}
            aria-pressed={source === 'linuxserver'}
            onclick={() => selectSource('linuxserver')}
          >LinuxServer</button>
        </div>
      </div>
      <div class="selector-row">
        <span class="selector-label" id="target-selector-label">Target format</span>
        <div class="mode selector-mode target-mode" role="group" aria-labelledby="target-selector-label">
          <button type="button" class:active={mode === 'command'} aria-pressed={mode === 'command'} onclick={() => (mode = 'command')}>Command line</button>
          <button type="button" class:active={mode === 'env'} aria-pressed={mode === 'env'} onclick={() => (mode = 'env')}>ENV</button>
          <button type="button" class:active={mode === 'labels'} aria-pressed={mode === 'labels'} onclick={() => (mode = 'labels')}>Docker labels</button>
        </div>
      </div>
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
          <button class="panel-button" type="button" onclick={insertAllOptions}>All options</button>
          <button class="panel-button" type="button" onclick={pasteInput}>Clear &amp; Paste</button>
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
        <div class="panel-actions">
          <button class="panel-button" type="button" onclick={selectOutput}>Select all</button>
          <button class="panel-button" type="button" onclick={copyOutput}>Copy</button>
        </div>
      </div>
      <p id="output-help" class="sr-only">Generated wollomatic/socket-proxy configuration. This field updates automatically when the input or output format changes.</p>
      <textarea bind:this={outputElement} value={result.output} aria-labelledby="output-title" aria-describedby="output-help output-status" readonly spellcheck="false"></textarea>
      <p id="output-status" class="panel-message" class:empty={!outputActionMessage} role="status" aria-live="polite">{outputActionMessage}</p>
    </section>
  </section>

  <footer>
    <br />
    Source profile: {result.source === 'tecnativa' ? 'Tecnativa' : 'LinuxServer'}<br />
    Enabled: {result.enabled.join(', ') || 'none'}<br />
    <br />
    This tool generates configuration output automatically based on the provided input. The generated configuration and code snippets must be reviewed, validated, and tested by a human before being used in production environments.<br />
    No guarantee is given regarding correctness, completeness, security, compatibility, or fitness for a particular purpose. Use at your own risk.<br />
    The authors and contributors assume no liability for any damage, data loss, security issues, downtime, or other consequences resulting from the use of the generated output.<br />
    <br />
    <a href="https://github.com/wollomatic/socket-proxy-configurator/blob/main/LICENSE">MIT license</a> | <a href="./third-party-licenses.md">Third-party licenses</a> | <a href="https://github.com/wollomatic/socket-proxy-configurator">Source Code (GitHub)</a> | <a href="https://mein.online-impressum.de/wollomatic/">Imprint</a> | <button class="footer-link" type="button" onclick={openPrivacyDialog}>Data protection</button><br />
    <br />
    wollomatic/socket-proxy-configurator <a href="https://github.com/wollomatic/socket-proxy-configurator/releases">version {appVersion}</a>, build date {buildDate}
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

  {#if networkInfoDialogOpen}
    <div class="dialog-layer">
      <button class="dialog-backdrop" type="button" tabindex="-1" aria-hidden="true" onclick={closeNetworkInfoDialog}></button>
      <div
        bind:this={networkInfoDialogElement}
        class="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="network-info-title"
        aria-describedby="network-info-description"
      >
        <div class="dialog-head">
          <h2 id="network-info-title">Network listener compatibility</h2>
          <button class="dialog-close" type="button" aria-label="Close network listener compatibility information" bind:this={networkInfoCloseButton} onclick={closeNetworkInfoDialog}>Close</button>
        </div>
        <p id="network-info-description">
          docker-socket-proxy commonly listens on the Docker network and restricts clients by source address.
          Enabling this option adds wollomatic/socket-proxy listener settings that mirror that setup when no explicit values are provided.
        </p>
        <p>
          The converter adds listenip and allowfrom defaults for command-line and ENV output. Review the generated allowfrom value and restrict it to trusted client CIDRs or hostnames before using it in production.
        </p>
        <p>
          Security note: allowing all clients on a Docker network is convenient, but broad. wollomatic/socket-proxy can do better than that by limiting access to specific client containers, CIDRs, or hostnames, so prefer a narrow allowfrom value whenever possible.
        </p>
      </div>
    </div>
  {/if}

  {#if methodInfoDialogOpen}
    <div class="dialog-layer">
      <button class="dialog-backdrop" type="button" tabindex="-1" aria-hidden="true" onclick={closeMethodInfoDialog}></button>
      <div
        bind:this={methodInfoDialogElement}
        class="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="method-info-title"
        aria-describedby="method-info-description"
      >
        <div class="dialog-head">
          <h2 id="method-info-title">Broader source-proxy permissions</h2>
          <button class="dialog-close" type="button" aria-label="Close broader source-proxy permissions information" bind:this={methodInfoCloseButton} onclick={closeMethodInfoDialog}>Close</button>
        </div>
        <p id="method-info-description">
          By default, the converter generates a reduced allowlist containing only HTTP methods and valid path patterns required by the Docker API.
        </p>
        <p>
          Tecnativa and LinuxServer use broader HAProxy rules. These rules may allow additional HTTP methods, case-insensitive path prefixes, and paths that are not valid Docker API endpoints.
        </p>
        <p>
          Enable this option to reproduce those broader source-proxy permissions more closely. This improves behavioral parity with the selected source proxy, but creates a less restrictive wollomatic/socket-proxy configuration.
        </p>
        <p>
          For example, the default pattern <code>(/v[\d.]+)?/_ping</code> accepts only the exact Docker endpoint. The broader pattern <code>(?i:(/v[\d.]+)?/_ping.*)</code> also accepts differently cased and suffixed paths such as <code>/_PING</code> and <code>/_pingAnything</code>.
        </p>
        <p class="dialog-warning" role="note">
          <strong>Warning:</strong> This mode intentionally allows requests beyond valid Docker or Podman API paths. Enable it only when matching the source proxy's broader behavior is more important than keeping the generated allowlist as restrictive as possible.
        </p>
        <p>
          LinuxServer action toggles are special: they can allow container and Podman actions even when POST=0. Tecnativa keeps those actions behind POST.
        </p>
      </div>
    </div>
  {/if}
</main>
