import "./style.css";

type GamePhase =
  | "briefing"
  | "investigation"
  | "kernel"
  | "blast-radius"
  | "isolation"
  | "complete";

interface TerminalEntry {
  type: "command" | "response";
  text: string;
}

interface GameState {
  phase: GamePhase;

  terminalHistory: TerminalEntry[];
  commandRunning: boolean;

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

interface Objective {
  id: string;
  title: string;
  description: string;
  complete: boolean;
}


// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------

const state: GameState = {
  phase: "briefing",

  terminalHistory: [],
  commandRunning: false,

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


// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app element");
}


// ===========================================================================
// SIMULATED WEBERNETES COMMAND ENGINE
// ===========================================================================
//
// This is intentionally local to the browser.
//
// The goal is to simulate the investigation environment without requiring
// a backend API while the challenge is being developed.
//
// Later, this function can be replaced with:
//
//   fetch("/command?cmd=...")
//
// or a real Webernetes service.
//
// ===========================================================================

async function runCommand(command: string): Promise<string> {
  state.commandCount++;

  // Small delay makes the terminal feel like a real remote environment.
  await sleep(350);

  const normalized = command.trim().toLowerCase();

  if (!normalized) {
    return "";
  }

  // -------------------------------------------------------------------------
  // Help
  // -------------------------------------------------------------------------

  if (normalized === "help") {
    return [
      "WEBERNETES SECURITY CONSOLE",
      "===========================",
      "",
      "Available commands:",
      "",
      "  whoami",
      "  hostname",
      "  env",
      "  ps",
      "",
      "  cat /etc/workload",
      "  cat /etc/security-boundary",
      "  cat /etc/node",
      "",
      "  kubectl get pods",
      "  kubectl get namespaces",
      "",
      "  inspect workload",
      "  inspect node",
      "  scan kernel",
      "",
      "  exploit kernel",
      "  list tenants",
      "  access customer-b",
      "  access platform",
      "",
      "  inspect isolation",
      "  exploit isolated",
      "  access isolated-neighbor",
      "",
      "  submit <flag>",
      "",
      "Hint:",
      "The interesting question is not whether the workload is",
      "isolated from a process perspective.",
      "The interesting question is what happens when that",
      "boundary is compromised.",
    ].join("\n");
  }


  // -------------------------------------------------------------------------
  // Basic shell commands
  // -------------------------------------------------------------------------

  if (normalized === "whoami") {
    return [
      "customer-a",
      "",
      "uid=1000(customer-a)",
      "gid=1000(customer-a)",
      "groups=customer-a,workload",
    ].join("\n");
  }


  if (normalized === "hostname") {
    state.discoveredNode = true;

    return [
      "image-processor.customer-a",
      "",
      "node: worker-02",
    ].join("\n");
  }


  if (normalized === "env") {
    state.discoveredCodeExecution = true;

    return [
      "WORKLOAD_NAME=image-processor",
      "TENANT_ID=customer-a",
      "EXECUTION_MODE=customer-supplied",
      "CODE_EXECUTION=arbitrary",
      "PLATFORM=webernetes",
      "NODE=worker-02",
    ].join("\n");
  }


  if (normalized === "ps") {
    return [
      "PID   USER          COMMAND",
      "1     customer-a   /app/image-processor",
      "17    customer-a   python worker.py",
      "23    customer-a   /bin/sh",
      "",
      "NOTE:",
      "This workload is executing customer-supplied processing code.",
    ].join("\n");
  }


  // -------------------------------------------------------------------------
  // Workload inspection
  // -------------------------------------------------------------------------

  if (normalized === "cat /etc/workload") {
    state.discoveredCodeExecution = true;

    return [
      "ACME COMPUTE WORKLOAD MANIFEST",
      "==============================",
      "",
      "workload: image-processor",
      "tenant: customer-a",
      "node: worker-02",
      "",
      "execution:",
      "  mode: customer-supplied",
      "  arbitrary-code: enabled",
      "  trust-level: untrusted",
      "",
      "container:",
      "  runtime: containerd",
      "  isolation: linux namespaces + cgroups",
      "",
      "security note:",
      "Customer code is intentionally untrusted.",
    ].join("\n");
  }


  if (normalized === "cat /etc/security-boundary") {
    state.discoveredSharedKernel = true;

    return [
      "SECURITY BOUNDARY",
      "=================",
      "",
      "workload isolation: container",
      "process isolation: namespaces",
      "resource isolation: cgroups",
      "",
      "kernel isolation: NONE",
      "",
      "All containers on this node execute against",
      "the same Linux kernel.",
      "",
      "SECURITY BOUNDARY:",
      "  container namespace",
      "        |",
      "        v",
      "  shared Linux kernel",
      "",
      "WARNING:",
      "A kernel compromise may cross container boundaries.",
    ].join("\n");
  }


  if (normalized === "cat /etc/node") {
    state.discoveredNode = true;
    state.discoveredSharedKernel = true;

    return [
      "NODE INFORMATION",
      "================",
      "",
      "node: worker-02",
      "provider: acme-compute",
      "orchestrator: webernetes",
      "runtime: containerd",
      "",
      "kernel:",
      "  Linux 6.8.12-acme",
      "  kernel-id: acme-kernel-001",
      "",
      "workloads sharing node:",
      "  image-processor.customer-a",
      "  billing-api.customer-b",
      "  platform-controller",
      "",
      "All listed workloads share the host kernel.",
    ].join("\n");
  }


  // -------------------------------------------------------------------------
  // Kubernetes / Webernetes commands
  // -------------------------------------------------------------------------

  if (normalized === "kubectl get pods") {
    state.discoveredNode = true;

    return [
      "NAMESPACE      NAME                         READY   STATUS",
      "customer-a     image-processor             1/1     Running",
      "customer-b     billing-api                 1/1     Running",
      "platform       platform-controller         1/1     Running",
      "",
      "NODE",
      "----",
      "image-processor             worker-02",
      "billing-api                 worker-02",
      "platform-controller         worker-02",
    ].join("\n");
  }


  if (normalized === "kubectl get namespaces") {
    return [
      "NAME",
      "----",
      "default",
      "customer-a",
      "customer-b",
      "platform",
      "kube-system",
      "",
      "NOTE:",
      "Namespaces provide logical separation.",
      "They do not create independent Linux kernels.",
    ].join("\n");
  }


  if (normalized.startsWith("kubectl")) {
    return [
      `kubectl: unknown command "${command.slice(8).trim()}"`,
      "",
      "Try:",
      "  kubectl get pods",
      "  kubectl get namespaces",
    ].join("\n");
  }


  // -------------------------------------------------------------------------
  // Investigation helpers
  // -------------------------------------------------------------------------

  if (normalized === "inspect workload") {
    state.discoveredCodeExecution = true;

    return [
      "WORKLOAD INSPECTION",
      "===================",
      "",
      "name: image-processor",
      "tenant: customer-a",
      "status: compromised",
      "",
      "execution model:",
      "  customer-supplied processing code",
      "  arbitrary code execution: YES",
      "",
      "container boundary:",
      "  namespaces: enabled",
      "  cgroups: enabled",
      "",
      "kernel boundary:",
      "  isolated kernel: NO",
      "  shared host kernel: YES",
    ].join("\n");
  }


  if (normalized === "inspect node") {
    state.discoveredNode = true;
    state.discoveredSharedKernel = true;

    return [
      "NODE INSPECTION",
      "===============",
      "",
      "node: worker-02",
      "kernel: Linux 6.8.12-acme",
      "kernel-id: acme-kernel-001",
      "",
      "ACTIVE WORKLOADS",
      "----------------",
      "customer-a/image-processor",
      "customer-b/billing-api",
      "platform/platform-controller",
      "",
      "BOUNDARY:",
      "All workloads share the same kernel.",
    ].join("\n");
  }


  // -------------------------------------------------------------------------
  // Kernel investigation
  // -------------------------------------------------------------------------

  if (normalized === "scan kernel") {
    state.discoveredNode = true;
    state.discoveredSharedKernel = true;
    state.kernelScanned = true;
    state.phase = "kernel";

    return [
      "KERNEL SECURITY SCAN",
      "=====================",
      "",
      "target: worker-02",
      "kernel-id: acme-kernel-001",
      "",
      "[+] Enumerating kernel attack surface...",
      "[+] Checking namespace boundary...",
      "[+] Checking privilege transitions...",
      "[+] Checking shared-kernel interfaces...",
      "",
      "FINDING: KERNEL-ESC-001",
      "-----------------------",
      "",
      "severity: HIGH",
      "component: shared Linux kernel",
      "status: exploitable",
      "",
      "A successful kernel compromise would execute",
      "outside the originating container namespace.",
      "",
      "Potential impact:",
      "  - access to other workloads",
      "  - access to node resources",
      "  - access to platform services",
      "",
      "NEXT STEP:",
      "Determine the blast radius.",
    ].join("\n");
  }


  // -------------------------------------------------------------------------
  // Kernel exploitation
  // -------------------------------------------------------------------------

  if (normalized === "exploit kernel") {
    if (!state.kernelScanned) {
      return [
        "EXPLOIT BLOCKED",
        "",
        "You have not established a kernel vulnerability.",
        "",
        "Try:",
        "  scan kernel",
      ].join("\n");
    }

    state.kernelCompromised = true;
    state.phase = "blast-radius";

    return [
      "KERNEL EXPLOIT",
      "==============",
      "",
      "[+] Preparing exploit...",
      "[+] Target: acme-kernel-001",
      "[+] Crossing container namespace...",
      "[+] Kernel privilege boundary reached.",
      "",
      "KERNEL COMPROMISED",
      "==================",
      "",
      "The attacker is no longer confined to the",
      "original customer-a container.",
      "",
      "You now have node-level access.",
      "",
      "The container boundary has been bypassed.",
      "",
      "NEXT STEP:",
      "Determine what else is reachable.",
    ].join("\n");
  }


  // -------------------------------------------------------------------------
  // Tenant discovery
  // -------------------------------------------------------------------------

  if (normalized === "list tenants") {
    if (!state.kernelCompromised) {
      return [
        "ACCESS DENIED",
        "",
        "Tenant enumeration requires node-level access.",
        "",
        "Investigate the shared kernel first.",
      ].join("\n");
    }

    return [
      "NODE-LEVEL TENANT ENUMERATION",
      "=============================",
      "",
      "worker-02 workloads:",
      "",
      "1. customer-a/image-processor",
      "   status: compromised",
      "",
      "2. customer-b/billing-api",
      "   status: running",
      "",
      "3. platform/platform-controller",
      "   status: running",
      "",
      "All three workloads are backed by the same",
      "Linux kernel.",
    ].join("\n");
  }


  // -------------------------------------------------------------------------
  // Cross-tenant access
  // -------------------------------------------------------------------------

  if (normalized === "access customer-b") {
    if (!state.kernelCompromised) {
      return [
        "ACCESS DENIED",
        "",
        "customer-b is outside the current container boundary.",
        "",
        "A successful kernel compromise is required.",
      ].join("\n");
    }

    state.customerBAccessed = true;

    return [
      "CROSS-TENANT ACCESS",
      "===================",
      "",
      "[+] Enumerating node workloads...",
      "[+] Found customer-b/billing-api",
      "[+] Accessing workload context...",
      "",
      "ACCESS GRANTED",
      "",
      "tenant: customer-b",
      "workload: billing-api",
      "node: worker-02",
      "",
      "RESULT:",
      "The compromised customer-a workload can reach",
      "another tenant after crossing the shared kernel.",
    ].join("\n");
  }


  if (normalized === "access platform") {
    if (!state.kernelCompromised) {
      return [
        "ACCESS DENIED",
        "",
        "Platform services are outside the current",
        "container boundary.",
      ].join("\n");
    }

    state.platformAccessed = true;

    return [
      "PLATFORM ACCESS",
      "===============",
      "",
      "[+] Enumerating node resources...",
      "[+] Found platform-controller",
      "[+] Found kube-system services",
      "",
      "ACCESS GRANTED",
      "",
      "The compromised workload has reached services",
      "outside its original tenant boundary.",
      "",
      "IMPACT:",
      "  customer workloads",
      "  platform services",
      "  node resources",
    ].join("\n");
  }


  // -------------------------------------------------------------------------
  // Isolation comparison
  // -------------------------------------------------------------------------

  if (normalized === "inspect isolation") {
    state.isolatedDiscovered = true;
    state.phase = "isolation";

    return [
      "ISOLATION LAB",
      "=============",
      "",
      "A second workload is available for comparison.",
      "",
      "workload: customer-c/ai-agent",
      "execution: untrusted",
      "",
      "isolation model:",
      "  container: YES",
      "  dedicated zone: YES",
      "  zone kernel: YES",
      "  shared host kernel: NO",
      "",
      "boundary:",
      "",
      "  customer-c workload",
      "          |",
      "          v",
      "     zone kernel",
      "          |",
      "          v",
      "       hardware",
      "",
      "The workload does not share its kernel with",
      "unrelated tenant workloads.",
      "",
      "NEXT STEP:",
      "Test the same compromise.",
    ].join("\n");
  }


  if (normalized === "exploit isolated") {
    if (!state.isolatedDiscovered) {
      return [
        "TARGET NOT FOUND",
        "",
        "Discover the isolated workload first.",
        "",
        "Try:",
        "  inspect isolation",
      ].join("\n");
    }

    state.isolatedTested = true;

    return [
      "ISOLATED ZONE TEST",
      "==================",
      "",
      "[+] Simulating workload compromise...",
      "[+] Attacker gains control of customer-c workload.",
      "[+] Attempting kernel boundary traversal...",
      "",
      "BOUNDARY REACHED",
      "",
      "The workload has access to its isolated zone.",
      "",
      "ATTEMPTING CROSS-TENANT ACCESS...",
      "",
      "BLOCKED",
      "",
      "No shared host kernel was available to cross.",
      "",
      "RESULT:",
      "The same workload compromise does not provide",
      "direct access to unrelated tenant workloads.",
    ].join("\n");
  }


  if (normalized === "access isolated-neighbor") {
    if (!state.isolatedDiscovered) {
      return [
        "TARGET NOT FOUND",
        "",
        "Discover the isolated workload first.",
      ].join("\n");
    }

    state.isolatedTested = true;

    return [
      "CROSS-ZONE ACCESS TEST",
      "======================",
      "",
      "source: customer-c/ai-agent",
      "target: unrelated tenant",
      "",
      "[+] Attempting access...",
      "[+] Attempting shared-kernel traversal...",
      "",
      "ACCESS BLOCKED",
      "",
      "The target workload is outside the isolated zone.",
      "",
      "No shared kernel connects the two workloads.",
    ].join("\n");
  }


  // -------------------------------------------------------------------------
  // Flag submission
  // -------------------------------------------------------------------------

  if (normalized.startsWith("submit ")) {
    const submittedFlag = command.trim().slice(7).trim();

    const correctFlag = "EDERA{THE_KERNEL_WAS_THE_BOUNDARY}";

    if (submittedFlag === correctFlag) {
      state.flagSubmitted = true;
      state.phase = "complete";

      return [
        "SUBMISSION",
        "==========",
        "",
        "ACCESS GRANTED",
        "",
        "Flag accepted.",
        "",
        "EDERA{THE_KERNEL_WAS_THE_BOUNDARY}",
        "",
        "INVESTIGATION COMPLETE",
        "",
        "You established:",
        "",
        "  1. The workload executes untrusted code.",
        "  2. Containers share the node kernel.",
        "  3. The kernel is a security boundary.",
        "  4. Kernel compromise crosses container boundaries.",
        "  5. The resulting blast radius includes other workloads.",
        "  6. An isolated execution zone changes that boundary.",
        "",
        "THE BOUNDARY WAS THE KERNEL.",
      ].join("\n");
    }

    return [
      "SUBMISSION REJECTED",
      "",
      "That flag is not correct.",
      "",
      "Review the investigation findings and try again.",
    ].join("\n");
  }


  // -------------------------------------------------------------------------
  // Unknown command
  // -------------------------------------------------------------------------

  return [
    `command not found: ${command}`,
    "",
    "Type 'help' for available commands.",
  ].join("\n");
}


// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}


// ===========================================================================
// GAME STATE DETECTION
// ===========================================================================

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
    text.includes("cve-like finding") ||
    text.includes("kernel-esc-001")
  ) {
    state.kernelScanned = true;
    state.phase = "kernel";
  }

  if (
    command.trim().toLowerCase() === "exploit kernel" &&
    text.includes("kernel compromised")
  ) {
    state.kernelCompromised = true;
    state.phase = "blast-radius";
  }

  if (
    command.trim().toLowerCase() === "access customer-b" &&
    text.includes("customer-b")
  ) {
    state.customerBAccessed = true;
  }

  if (
    command.trim().toLowerCase() === "access platform" &&
    text.includes("platform")
  ) {
    state.platformAccessed = true;
  }

  if (
    text.includes("isolated workload") ||
    text.includes("isolated zone") ||
    text.includes("zone kernel")
  ) {
    state.isolatedDiscovered = true;
    state.phase = "isolation";
  }

  if (
    command.trim().toLowerCase() === "exploit isolated" ||
    command.trim().toLowerCase() === "access isolated-neighbor"
  ) {
    state.isolatedTested = true;
  }

  if (
    command.trim().toLowerCase().startsWith("submit ") &&
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


// ===========================================================================
// RENDERING
// ===========================================================================

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


// ===========================================================================
// TOP BAR
// ===========================================================================

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


// ===========================================================================
// MISSION
// ===========================================================================

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


// ===========================================================================
// TERMINAL
// ===========================================================================

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
        ${renderTerminalHistory()}
      </div>

      <form id="terminal-form" class="terminal-input">
        <span class="prompt">customer-a@image-processor:~$</span>

        <input
          id="command-input"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          aria-label="Terminal command"
          ${state.commandRunning ? "disabled" : ""}
        />

        <button
          type="submit"
          aria-label="Run command"
          ${state.commandRunning ? "disabled" : ""}
        >
          ↵
        </button>
      </form>

    </div>
  `;
}


function renderTerminalHistory(): string {
  let html = "";

  if (state.terminalHistory.length === 0) {
    html = renderWelcome();
  } else {
    html = state.terminalHistory
      .map((entry) => {
        if (entry.type === "command") {
          return `
            <pre class="terminal-line terminal-command">${escapeHtml(
              entry.text,
            )}</pre>
          `;
        }

        return `
          <pre class="terminal-line terminal-response">${escapeHtml(
            entry.text,
          )}</pre>
        `;
      })
      .join("");
  }

  if (state.commandRunning) {
    html += `
      <pre class="terminal-line terminal-loading">Running...</pre>
    `;
  }

  return html;
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


function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


// ===========================================================================
// ARCHITECTURE
// ===========================================================================

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


// ===========================================================================
// OBJECTIVES
// ===========================================================================

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
      complete:
        state.discoveredNode && state.discoveredSharedKernel,
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

  return index === -1
    ? objectives.length - 1
    : index;
}


function getProgress(): number {
  const objectives = getObjectives();

  const completed = objectives.filter(
    (objective) => objective.complete,
  ).length;

  return Math.round(
    (completed / objectives.length) * 100,
  );
}


// ===========================================================================
// FOOTER
// ===========================================================================

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


// ===========================================================================
// EVENTS
// ===========================================================================

function bindEvents(): void {
  const form =
    document.querySelector<HTMLFormElement>(
      "#terminal-form",
    );

  const input =
    document.querySelector<HTMLInputElement>(
      "#command-input",
    );

  if (!form || !input) {
    return;
  }

  form.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      const command = input.value.trim();

      if (
        !command ||
        state.commandRunning
      ) {
        return;
      }

      input.value = "";

      state.terminalHistory.push({
        type: "command",
        text:
          `customer-a@image-processor:~$ ${command}`,
      });

      state.commandRunning = true;

      render();

      const result =
        await runCommand(command);

      state.commandRunning = false;

      inspectOutput(
        command,
        result,
      );

      state.terminalHistory.push({
        type: "response",
        text: result,
      });

      render();

      setTimeout(() => {
        document
          .querySelector<HTMLInputElement>(
            "#command-input",
          )
          ?.focus();
      }, 0);
    },
  );

  input.focus();
}


// ===========================================================================
// KEYBOARD SHORTCUTS
// ===========================================================================

document.addEventListener(
  "keydown",
  (event) => {
    if (
      event.key === "/" &&
      document.activeElement?.tagName !== "INPUT"
    ) {
      event.preventDefault();

      document
        .querySelector<HTMLInputElement>(
          "#command-input",
        )
        ?.focus();
    }
  },
);


// ===========================================================================
// INITIAL RENDER
// ===========================================================================

render();
