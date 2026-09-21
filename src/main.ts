/**
 * THE BOUNDARY
 *
 * Browser-side game UI.
 *
 * No framework required.
 *
 * Expected HTML:
 *
 *   <div id="app"></div>
 *
 * The game communicates with the challenge workload through:
 *
 *   GET /command?cmd=<command>
 *
 * If you're running the terminal through a different Webernetes service,
 * change COMMAND_ENDPOINT below.
 */

const COMMAND_ENDPOINT = "/command";

type GamePhase =
  | "briefing"
  | "investigation"
  | "kernel"
  | "blast-radius"
  | "isolation"
  | "complete";

interface GameState {
  phase: GamePhase;

  discoveredCodeExecution: boolean;
  discoveredNode: boolean;
  discoveredSharedKernel: boolean;
  kernelScanned: boolean;
  kernelCompromised: boolean;
  customerBAccessed: boolean;
  platformAccessed: boolean;
  isolatedDiscovered: boolean;
  isolatedTested: boolean;
  flagSubmitted: boolean;

  commandCount: number;
}

const state: GameState = {
  phase: "briefing",

  discoveredCodeExecution: false,
  discoveredNode: false,
  discoveredSharedKernel: false,
  kernelScanned: false,
  kernelCompromised: false,
  customerBAccessed: false,
  platformAccessed: false,
  isolatedDiscovered: false,
  isolatedTested: false,
  flagSubmitted: false,

  commandCount: 0,
};

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app element");
}


// ---------------------------------------------------------------------------
// Command execution
// ---------------------------------------------------------------------------

async function runCommand(command: string): Promise<string> {
  state.commandCount++;

  try {
    const response = await fetch(
      `${COMMAND_ENDPOINT}?cmd=${encodeURIComponent(command)}`,
    );

    if (!response.ok) {
      return `Command failed: HTTP ${response.status}`;
    }

    return await response.text();
  } catch (error) {
    return [
      "Unable to reach the challenge workload.",
      "",
      String(error),
    ].join("\n");
  }
}


// ---------------------------------------------------------------------------
// Game state detection
// ---------------------------------------------------------------------------

function inspectOutput(command: string, output: string): void {
  const text = `${command}\n${output}`.toLowerCase();

  if (
    text.includes("arbitrary customer processing code") ||
    text.includes("customer-supplied") ||
    text.includes("code execution")
  ) {
    state.discoveredCodeExecution = true;
  }

  if (
    text.includes("worker-02") ||
    text.includes("shared kernel") ||
    text.includes("same linux kernel")
  ) {
    state.discoveredNode = true;
  }

  if (
    text.includes("shared kernel") ||
    text.includes("security boundary")
  ) {
    state.discoveredSharedKernel = true;
  }

  if (
    text.includes("acme-kernel-001") ||
    text.includes("cve-like finding")
  ) {
    state.kernelScanned = true;
    state.phase = "kernel";
  }

  if (
    command === "exploit kernel" &&
    text.includes("kernel compromised")
  ) {
    state.kernelCompromised = true;
    state.phase = "blast-radius";
  }

  if (
    command === "access customer-b" &&
    text.includes("customer-b")
  ) {
    state.customerBAccessed = true;
  }

  if (
    command === "access platform" &&
    text.includes("platform")
  ) {
    state.platformAccessed = true;
  }

  if (
    text.includes("isolated workload") ||
    text.includes("isolated zone")
  ) {
    state.isolatedDiscovered = true;
    state.phase = "isolation";
  }

  if (
    command === "exploit isolated" ||
    command === "access isolated-neighbor"
  ) {
    state.isolatedTested = true;
  }

  if (
    command.startsWith("submit ") &&
    text.includes("access granted")
  ) {
    state.flagSubmitted = true;
    state.phase = "complete";
  }

  updatePhase();
}

function updatePhase(): void {
  if (state.flagSubmitted) {
    state.phase = "complete";
    return;
  }

  if (state.isolatedDiscovered) {
    state.phase = "isolation";
    return;
  }

  if (state.kernelCompromised) {
    state.phase = "blast-radius";
    return;
  }

  if (state.kernelScanned) {
    state.phase = "kernel";
    return;
  }

  state.phase = "investigation";
}


// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function render(): void {
  app.innerHTML = `
    <div class="game">

      ${renderTopBar()}

      <main class="main">

        <section class="mission">
          ${renderMission()}
        </section>

        <section class="workspace">

          <div class="terminal-panel">
            ${renderTerminal()}
          </div>

          <aside class="sidebar">

            <div class="card architecture-card">
              <div class="card-header">
                <span>ARCHITECTURE</span>
                <span class="live-dot"></span>
              </div>

              ${renderArchitecture()}
            </div>

            <div class="card objectives-card">
              <div class="card-header">
                <span>INVESTIGATION</span>
                <span class="progress">
                  ${getProgress()}%
                </span>
              </div>

              ${renderObjectives()}
            </div>

          </aside>

        </section>

      </main>

      ${renderFooter()}

    </div>
  `;

  bindEvents();
}


// ---------------------------------------------------------------------------
// Top bar
// ---------------------------------------------------------------------------

function renderTopBar(): string {
  return `
    <header class="topbar">

      <div class="brand">
        <div class="brand-mark">
          <span></span>
          <span></span>
          <span></span>
        </div>

        <div>
          <div class="brand-name">ACME COMPUTE</div>
          <div class="brand-subtitle">SECURITY OPERATIONS</div>
        </div>
      </div>

      <div class="challenge-title">
        <span class="eyebrow">SECURITY CHALLENGE 01</span>
        <strong>THE BOUNDARY</strong>
      </div>

      <div class="status">
        <span class="status-dot"></span>
        LIVE ENVIRONMENT
      </div>

    </header>
  `;
}


// ---------------------------------------------------------------------------
// Mission briefing
// ---------------------------------------------------------------------------

function renderMission(): string {
  if (state.flagSubmitted) {
    return `
      <div class="mission-complete">
        <div class="complete-icon">✓</div>

        <div>
          <div class="eyebrow">INVESTIGATION COMPLETE</div>

          <h1>The boundary was the kernel.</h1>

          <p>
            You demonstrated that compromising untrusted code is only
            half the problem. The critical question is what the compromised
            workload can reach afterwards.
          </p>
        </div>
      </div>
    `;
  }

  return `
    <div class="mission-header">
      <div>
        <div class="eyebrow">MISSION</div>
        <h1>Find the real security boundary.</h1>
      </div>

      <div class="mission-meta">
        <span>CASE</span>
        <strong>ACME-SEC-001</strong>
      </div>
    </div>

    <div class="mission-copy">
      <p>
        Acme Compute allows customers to execute arbitrary processing code
        on its Kubernetes platform.
      </p>

      <p>
        A customer workload has been compromised. Your job is to determine
        whether that compromise can affect another tenant.
      </p>

      <div class="mission-warning">
        <span class="warning-icon">!</span>

        <span>
          You have access to the workload, but <strong>not</strong> to a
          real Linux kernel. The security model is intentionally simulated.
        </span>
      </div>
    </div>
  `;
}


// ---------------------------------------------------------------------------
// Terminal
// ---------------------------------------------------------------------------

function renderTerminal(): string {
  return `
    <div class="terminal">

      <div class="terminal-titlebar">
        <div class="terminal-lights">
          <span></span>
          <span></span>
          <span></span>
        </div>

        <div class="terminal-title">
          shell — image-processor.customer-a
        </div>

        <div class="terminal-lock">
          ● SECURE SESSION
        </div>
      </div>

      <div id="terminal-output" class="terminal-output">
        ${renderWelcome()}
      </div>

      <form id="terminal-form" class="terminal-input">
        <span class="prompt">customer-a@image-processor:~$</span>

        <input
          id="command-input"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          aria-label="Terminal command"
        />

        <button type="submit" aria-label="Run command">
          ↵
        </button>
      </form>

    </div>
  `;
}


function renderWelcome(): string {
  return `
    <div class="terminal-line terminal-system">
      ACME COMPUTE SECURITY CONSOLE
    </div>

    <div class="terminal-line terminal-muted">
      Security investigation environment initialized.
    </div>

    <br>

    <div class="terminal-line">
      A customer workload is executing untrusted code.
    </div>

    <div class="terminal-line">
      Determine whether another tenant can be affected.
    </div>

    <br>

    <div class="terminal-line terminal-muted">
      Type <span class="command-highlight">help</span> for available commands.
    </div>

    <br>
  `;
}


// ---------------------------------------------------------------------------
// Architecture diagram
// ---------------------------------------------------------------------------

function renderArchitecture(): string {
  if (state.phase === "complete") {
    return renderIsolatedArchitecture();
  }

  if (state.isolatedDiscovered) {
    return renderComparisonArchitecture();
  }

  if (state.kernelCompromised) {
    return renderCompromisedArchitecture();
  }

  if (state.discoveredSharedKernel || state.discoveredNode) {
    return renderSharedKernelArchitecture();
  }

  return renderInitialArchitecture();
}


function renderInitialArchitecture(): string {
  return `
    <div class="architecture">

      <div class="arch-tenant-row">

        <div class="arch-workload">
          <span class="arch-icon customer-icon">A</span>
          <div>
            <strong>customer-a</strong>
            <small>image-processor</small>
          </div>
        </div>

        <div class="arch-workload dim">
          <span class="arch-icon">B</span>
          <div>
            <strong>customer-b</strong>
            <small>billing-api</small>
          </div>
        </div>

      </div>

      <div class="arch-arrow">↓</div>

      <div class="arch-box container-box">
        <span class="arch-box-label">CONTAINERS</span>
        <small>process isolation</small>
      </div>

      <div class="arch-arrow">↓</div>

      <div class="arch-box unknown-box">
        <span class="question">?</span>
        <span>SECURITY BOUNDARY</span>
      </div>

      <div class="arch-hint">
        <span>TIP</span>
        Find out what kernel this workload uses.
      </div>

    </div>
  `;
}


function renderSharedKernelArchitecture(): string {
  return `
    <div class="architecture revealed">

      <div class="arch-tenant-row">

        <div class="arch-workload active">
          <span class="arch-icon customer-icon">A</span>
          <div>
            <strong>customer-a</strong>
            <small>compromised</small>
          </div>
        </div>

        <div class="arch-workload">
          <span class="arch-icon">B</span>
          <div>
            <strong>customer-b</strong>
            <small>production</small>
          </div>
        </div>

      </div>

      <div class="arch-arrow">↓</div>

      <div class="arch-box container-box">
        <span class="arch-box-label">CONTAINERS</span>
        <small>namespace / process isolation</small>
      </div>

      <div class="arch-arrow">↓</div>

      <div class="arch-box kernel-box">
        <span class="kernel-icon">K</span>

        <div>
          <strong>LINUX KERNEL</strong>
          <small>shared by both workloads</small>
        </div>
      </div>

      <div class="shared-label">
        SHARED SECURITY BOUNDARY
      </div>

    </div>
  `;
}


function renderCompromisedArchitecture(): string {
  return `
    <div class="architecture compromised">

      <div class="arch-tenant-row">

        <div class="arch-workload compromised-workload">
          <span class="arch-icon customer-icon">A</span>
          <div>
            <strong>customer-a</strong>
            <small>COMPROMISED</small>
          </div>
        </div>

        <div class="arch-workload exposed-workload">
          <span class="arch-icon">B</span>
          <div>
            <strong>customer-b</strong>
            <small>EXPOSED</small>
          </div>
        </div>

      </div>

      <div class="arch-arrow danger">↓</div>

      <div class="arch-box kernel-box danger-box">
        <span class="kernel-icon">K</span>

        <div>
          <strong>KERNEL COMPROMISED</strong>
          <small>container boundary no longer sufficient</small>
        </div>
      </div>

      <div class="blast-radius">
        <div class="blast-title">BLAST RADIUS</div>

        <div class="blast-item">
          <span>●</span>
          customer-b
        </div>

        <div class="blast-item">
          <span>●</span>
          platform services
        </div>

        <div class="blast-item">
          <span>●</span>
          node resources
        </div>
      </div>

    </div>
  `;
}


function renderComparisonArchitecture(): string {
  return `
    <div class="architecture comparison">

      <div class="comparison-title">
        SAME ATTACK — DIFFERENT BOUNDARY
      </div>

      <div class="comparison-row">

        <div class="comparison-side shared">
          <div class="comparison-label">
            SHARED KERNEL
          </div>

          <div class="mini-workload">A</div>
          <div class="mini-arrow">↓</div>
          <div class="mini-kernel danger">KERNEL</div>
          <div class="mini-arrow">↓</div>
          <div class="mini-workload exposed">B</div>

          <div class="comparison-result danger-text">
            CROSS-TENANT IMPACT
          </div>
        </div>

        <div class="comparison-side isolated">
          <div class="comparison-label">
            ISOLATED ZONE
          </div>

          <div class="mini-workload">C</div>
          <div class="mini-arrow">↓</div>
          <div class="mini-kernel safe">ZONE KERNEL</div>
          <div class="mini-arrow">↓</div>
          <div class="hardware-boundary">HARDWARE</div>

          <div class="comparison-result safe-text">
            BOUNDARY HOLDS
          </div>
        </div>

      </div>

    </div>
  `;
}


function renderIsolatedArchitecture(): string {
  return `
    <div class="architecture final-architecture">

      <div class="arch-box safe-zone">
        <div class="safe-zone-header">
          <span class="check">✓</span>
          ISOLATED ZONE
        </div>

        <div class="safe-zone-workload">
          customer-c / ai-agent
        </div>

        <div class="arch-arrow">↓</div>

        <div class="safe-zone-kernel">
          ZONE KERNEL
        </div>
      </div>

      <div class="hardware-line">
        <span>HARDWARE-ENFORCED BOUNDARY</span>
      </div>

      <div class="isolation-message">
        <strong>COMPROMISE CONTAINED</strong>
        <small>
          The workload can be compromised without sharing its kernel
          with unrelated tenant workloads.
        </small>
      </div>

    </div>
  `;
}


// ---------------------------------------------------------------------------
// Objectives
// ---------------------------------------------------------------------------

interface Objective {
  id: string;
  title: string;
  description: string;
  complete: boolean;
}

function getObjectives(): Objective[] {
  return [
    {
      id: "code",
      title: "Find the untrusted code",
      description: "Determine what the workload is allowed to execute.",
      complete: state.discoveredCodeExecution,
    },
    {
      id: "node",
      title: "Identify the execution boundary",
      description: "Find out which node and kernel the workload uses.",
      complete: state.discoveredNode && state.discoveredSharedKernel,
    },
    {
      id: "kernel",
      title: "Investigate the kernel",
      description: "Determine whether the shared kernel is vulnerable.",
      complete: state.kernelScanned,
    },
    {
      id: "blast",
      title: "Measure the blast radius",
      description: "Determine whether another tenant can be reached.",
      complete:
        state.customerBAccessed || state.platformAccessed,
    },
    {
      id: "isolation",
      title: "Test the alternative",
      description: "Compare the same compromise against an isolated zone.",
      complete: state.isolatedTested,
    },
    {
      id: "flag",
      title: "Complete the investigation",
      description: "Submit the final finding.",
      complete: state.flagSubmitted,
    },
  ];
}


function renderObjectives(): string {
  const objectives = getObjectives();

  return `
    <div class="objectives">

      ${objectives
        .map(
          (objective, index) => `
            <div
              class="
                objective
                ${objective.complete ? "complete" : ""}
                ${index === getCurrentObjectiveIndex() ? "current" : ""}
              "
            >
              <div class="objective-number">
                ${
                  objective.complete
                    ? "✓"
                    : String(index + 1).padStart(2, "0")
                }
              </div>

              <div class="objective-content">
                <strong>${objective.title}</strong>
                <small>${objective.description}</small>
              </div>
            </div>
          `,
        )
        .join("")}

    </div>
  `;
}


function getCurrentObjectiveIndex(): number {
  const objectives = getObjectives();

  const index = objectives.findIndex(
    (objective) => !objective.complete,
  );

  return index === -1 ? objectives.length - 1 : index;
}


function getProgress(): number {
  const objectives = getObjectives();

  const completed = objectives.filter(
    (objective) => objective.complete,
  ).length;

  return Math.round((completed / objectives.length) * 100);
}


// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

function renderFooter(): string {
  return `
    <footer class="footer">

      <div>
        <span class="footer-label">ENVIRONMENT</span>
        WEBERNETES
      </div>

      <div>
        <span class="footer-label">COMMANDS</span>
        ${state.commandCount}
      </div>

      <div>
        <span class="footer-label">CASE</span>
        ACME-SEC-001
      </div>

      <div class="footer-right">
        SIMULATION MODE
      </div>

    </footer>
  `;
}


// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

function bindEvents(): void {
  const form =
    document.querySelector<HTMLFormElement>("#terminal-form");

  const input =
    document.querySelector<HTMLInputElement>("#command-input");

  const output =
    document.querySelector<HTMLDivElement>("#terminal-output");

  if (!form || !input || !output) {
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const command = input.value.trim();

    if (!command) {
      return;
    }

    input.value = "";

    appendTerminalLine(
      output,
      `customer-a@image-processor:~$ ${command}`,
      "terminal-command",
    );

    appendTerminalLine(
      output,
      "Running...",
      "terminal-loading",
    );

    const result = await runCommand(command);

    const loadingLines =
      output.querySelectorAll(".terminal-loading");

    const lastLoading =
      loadingLines[loadingLines.length - 1];

    lastLoading?.remove();

    inspectOutput(command, result);

    appendTerminalLine(
      output,
      result,
      "terminal-response",
    );

    render();

    // Restore focus after re-render.
    setTimeout(() => {
      document
        .querySelector<HTMLInputElement>("#command-input")
        ?.focus();
    }, 0);
  });

  input.focus();
}


function appendTerminalLine(
  output: HTMLElement,
  text: string,
  className: string,
): void {
  const element = document.createElement("pre");

  element.className = `terminal-line ${className}`;

  element.textContent = text;

  output.appendChild(element);

  output.scrollTop = output.scrollHeight;
}


// ---------------------------------------------------------------------------
// Keyboard shortcuts
// ---------------------------------------------------------------------------

document.addEventListener("keydown", (event) => {
  if (event.key === "/" && document.activeElement?.tagName !== "INPUT") {
    event.preventDefault();

    document
      .querySelector<HTMLInputElement>("#command-input")
      ?.focus();
  }
});


// ---------------------------------------------------------------------------
// Initial render
// ---------------------------------------------------------------------------

render();
