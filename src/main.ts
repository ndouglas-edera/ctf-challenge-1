import "./style.css";

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

interface TerminalEntry {
  kind: "command" | "output" | "system";
  text: string;
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

const terminalHistory: TerminalEntry[] = [];

const PROMPT = "customer-a@image-processor:~$";

const OBJECTIVES = [
  "Find untrusted code",
  "Identify execution boundary",
  "Investigate kernel",
  "Measure blast radius",
  "Test isolated execution",
  "Submit finding",
];

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getObjectiveState(index: number): "complete" | "current" | "pending" {
  const completed = [
    state.discoveredCodeExecution,
    state.discoveredSharedKernel,
    state.kernelScanned && state.kernelCompromised,
    state.customerBAccessed && state.platformAccessed,
    state.isolatedTested,
    state.flagSubmitted,
  ];

  if (completed[index]) {
    return "complete";
  }

  const firstIncomplete = completed.findIndex((item) => !item);

  if (index === firstIncomplete) {
    return "current";
  }

  return "pending";
}

function getPhaseLabel(): string {
  switch (state.phase) {
    case "briefing":
      return "01 / BRIEFING";
    case "investigation":
      return "02 / INVESTIGATION";
    case "kernel":
      return "03 / KERNEL";
    case "blast-radius":
      return "04 / BLAST RADIUS";
    case "isolation":
      return "05 / ISOLATION";
    case "complete":
      return "06 / COMPLETE";
  }
}

function getBoundaryLabel(): string {
  if (state.flagSubmitted) {
    return "VERIFIED";
  }

  if (state.isolatedTested) {
    return "ISOLATED ZONE";
  }

  if (state.kernelCompromised) {
    return "COMPROMISED";
  }

  if (state.discoveredSharedKernel) {
    return "SHARED KERNEL";
  }

  return "UNKNOWN";
}

function updatePhase(): void {
  if (state.flagSubmitted) {
    state.phase = "complete";
    return;
  }

  if (state.isolatedTested) {
    state.phase = "isolation";
    return;
  }

  if (state.customerBAccessed || state.platformAccessed) {
    state.phase = "blast-radius";
    return;
  }

  if (state.kernelScanned || state.kernelCompromised) {
    state.phase = "kernel";
    return;
  }

  if (state.discoveredCodeExecution || state.discoveredSharedKernel) {
    state.phase = "investigation";
    return;
  }

  state.phase = "briefing";
}

const FILES: Record<string, string> = {
  "/.profile": [
    "# customer-a shell profile",
    "export TENANT=customer-a",
    "export WORKLOAD=image-processor",
    "export NODE=worker-02",
  ].join("\n"),

  "/workload.yaml": [
    "apiVersion: workloads.webernetes/v1",
    "kind: Workload",
    "metadata:",
    "  name: image-processor",
    "  namespace: customer-a",
    "spec:",
    "  execution: arbitrary-customer-code",
    "  trust: untrusted",
    "  runtime: containerd",
  ].join("\n"),

  "/app/image-processor": [
    "#!/bin/sh",
    "# simulated customer workload",
    "",
    "echo 'processing image'",
    "python /app/worker.py",
  ].join("\n"),

  "/app/worker.py": [
    "import os",
    "",
    "def process(job):",
    "    # Customer-supplied processing logic.",
    "    # The platform intentionally executes this code.",
    "    return transform(job)",
    "",
    "def transform(job):",
    "    return job",
  ].join("\n"),

  "/etc/workload": [
    "WORKLOAD PROFILE",
    "----------------",
    "tenant: customer-a",
    "application: image-processor",
    "execution: arbitrary customer processing code",
    "trust level: untrusted",
    "",
    "The workload is intentionally allowed to execute",
    "customer-supplied code.",
  ].join("\n"),

  "/etc/security-boundary": [
    "SECURITY BOUNDARY",
    "-----------------",
    "isolation: Linux containers",
    "process namespaces: enabled",
    "filesystem isolation: enabled",
    "network namespace: enabled",
    "cgroups: enabled",
    "",
    "WARNING:",
    "Containers share the host Linux kernel.",
  ].join("\n"),

  "/etc/node": [
    "NODE INFORMATION",
    "----------------",
    "node: worker-02",
    "runtime: containerd",
    "kernel: Linux 6.x",
    "kernel-id: acme-kernel-001",
    "",
    "Multiple customer workloads run on this node.",
  ].join("\n"),

  "/etc/hostname": "image-processor.customer-a",

  "/etc/os-release": [
    "NAME=Webernetes Linux",
    "ID=webernetes",
    "VERSION_ID=6.x",
    "PRETTY_NAME=\"Webernetes Worker Environment\"",
  ].join("\n"),

  "/opt/diagnostics/check-boundary.sh": [
    "#!/bin/sh",
    "",
    "echo \"Checking workload boundary...\"",
    "echo \"runtime: containerd\"",
    "echo \"namespace: customer-a\"",
    "echo \"kernel: shared\"",
    "echo \"host access: restricted\"",
    "",
    "# NOTE:",
    "# This check only verifies namespace configuration.",
    "# It does not establish a separate kernel boundary.",
  ].join("\n"),

  "/host/etc/node-config": [
    "NODE_CONFIG",
    "-----------",
    "node: worker-02",
    "runtime: containerd",
    "kernel: acme-kernel-001",
    "tenants: customer-a, customer-b, customer-c, platform",
    "",
    "WARNING: host configuration is outside the workload boundary.",
  ].join("\n"),

  "/host/var/lib/containers/tenant-map": [
    "TENANT MAP",
    "----------",
    "customer-a -> image-processor",
    "customer-b -> billing-api",
    "customer-c -> recommendation",
    "platform   -> platform-agent",
    "",
    "This data belongs to the node runtime.",
  ].join("\n"),

  "/proc/version": [
    "Linux version 6.x-webernetes",
    "(webernetes@worker-02)",
    "#1 SMP PREEMPT_DYNAMIC",
    "kernel-id=acme-kernel-001",
  ].join("\n"),

  "/proc/1/cgroup": [
    "0::/kubepods.slice/customer-a/image-processor",
    "",
    "# The process is isolated by cgroups.",
    "# The Linux kernel itself is not isolated.",
  ].join("\n"),

  "/proc/1/status": [
    "Name:   image-processor",
    "State:  S (sleeping)",
    "Pid:    1",
    "PPid:   0",
    "Uid:    1000",
    "Gid:    1000",
    "NSpid:  1",
  ].join("\n"),

  "/sys/kernel/security-boundary": [
    "KERNEL SECURITY BOUNDARY",
    "------------------------",
    "namespace isolation: yes",
    "cgroup isolation: yes",
    "filesystem isolation: yes",
    "kernel isolation: no",
    "",
    "All workloads on worker-02 depend on",
    "the same Linux kernel.",
  ].join("\n"),
};

const DIRECTORIES = new Set([
  "/",
  "/app",
  "/bin",
  "/etc",
  "/opt",
  "/opt/diagnostics",
  "/proc",
  "/proc/1",
  "/sys",
  "/host",
  "/host/etc",
  "/host/var",
  "/host/var/lib",
  "/host/var/lib/containers",
  "/tmp",
]);

const DIRECTORY_CONTENTS: Record<string, string[]> = {
  "/": [
    "app",
    "bin",
    "etc",
    "host",
    "opt",
    "proc",
    "sys",
    "tmp",
    ".profile",
    "workload.yaml",
  ],

  "/app": [
    "image-processor",
    "worker.py",
  ],

  "/bin": [
    "cat",
    "ls",
    "ps",
    "sh",
    "tree",
  ],

  "/etc": [
    "hostname",
    "node",
    "os-release",
    "security-boundary",
    "workload",
  ],

  "/opt": [
    "diagnostics",
  ],

  "/opt/diagnostics": [
    "check-boundary.sh",
  ],

  "/proc": [
    "1",
    "version",
  ],

  "/proc/1": [
    "cgroup",
    "status",
  ],

  "/sys": [
    "kernel",
  ],

  "/host": [
    "etc",
    "var",
  ],

  "/host/etc": [
    "node-config",
  ],

  "/host/var": [
    "lib",
  ],

  "/host/var/lib": [
    "containers",
  ],

  "/host/var/lib/containers": [
    "tenant-map",
  ],

  "/tmp": [],
};

function normalizePath(path: string, cwd = "/"): string {
  let target = path.trim();

  if (!target) {
    return cwd;
  }

  if (!target.startsWith("/")) {
    target = `${cwd.replace(/\/$/, "")}/${target}`;
  }

  const parts = target.split("/");
  const result: string[] = [];

  for (const part of parts) {
    if (!part || part === ".") {
      continue;
    }

    if (part === "..") {
      result.pop();
    } else {
      result.push(part);
    }
  }

  return `/${result.join("/")}`;
}

function getDirectoryListing(path: string, long = false): string {
  const normalized = normalizePath(path);

  if (!DIRECTORIES.has(normalized)) {
    return `ls: cannot access '${path}': No such file or directory`;
  }

  const entries = DIRECTORY_CONTENTS[normalized] ?? [];

  if (!long) {
    return entries.join("    ");
  }

  const lines = [
    `total ${entries.length + 2}`,
    "drwxr-xr-x  1 customer customer 4096 .",
    "drwxr-xr-x  1 root     root     4096 ..",
  ];

  for (const entry of entries) {
    const childPath =
      normalized === "/" ? `/${entry}` : `${normalized}/${entry}`;

    if (DIRECTORIES.has(childPath)) {
      lines.push(
        `drwxr-xr-x  2 customer customer 4096 ${entry}`,
      );
    } else {
      const size = FILES[childPath]?.length ?? 186;
      lines.push(
        `-rw-r--r--  1 customer customer ${String(size).padStart(
          4,
          " ",
        )} ${entry}`,
      );
    }
  }

  return lines.join("\n");
}

function buildTree(path = "/"): string {
  const normalized = normalizePath(path);

  if (!DIRECTORIES.has(normalized)) {
    return `tree: '${path}': No such file or directory`;
  }

  const lines: string[] = [normalized === "/" ? "~" : normalized];

  function walk(dir: string, prefix: string): void {
    const entries = DIRECTORY_CONTENTS[dir] ?? [];

    entries.forEach((entry, index) => {
      const last = index === entries.length - 1;
      const branch = last ? "└── " : "├── ";
      const child = dir === "/" ? `/${entry}` : `${dir}/${entry}`;

      lines.push(`${prefix}${branch}${entry}`);

      if (DIRECTORIES.has(child)) {
        walk(child, `${prefix}${last ? "    " : "│   "}`);
      }
    });
  }

  walk(normalized, "");

  return lines.join("\n");
}

function commandHelp(): string {
  return [
    "EDERA / ISOLATION RESEARCH LAB",
    "THE BOUNDARY / SECURITY CHALLENGE 01",
    "",
    "SHELL",
    "  pwd",
    "  ls",
    "  ls -la",
    "  tree",
    "  tree /",
    "  find / -maxdepth 2",
    "  cat <file>",
    "",
    "WORKLOAD",
    "  whoami",
    "  hostname",
    "  env",
    "  ps",
    "",
    "PLATFORM",
    "  kubectl get pods",
    "  kubectl get namespaces",
    "  inspect workload",
    "  inspect node",
    "  inspect isolation",
    "",
    "INVESTIGATION",
    "  scan kernel",
    "  exploit kernel",
    "  list tenants",
    "  access customer-b",
    "  access platform",
    "  verify isolation",
    "  inspect isolated",
    "  exploit isolated",
    "  access isolated-neighbor",
    "",
    "SUBMISSION",
    "  submit <flag>",
  ].join("\n");
}

function runCommand(command: string): string {
  const normalized = command.trim().toLowerCase();

  state.commandCount++;

  if (normalized === "help") {
    return commandHelp();
  }

  if (normalized === "pwd") {
    return "/home/customer";
  }

  if (normalized === "ls") {
    return getDirectoryListing("/");
  }

  if (
    normalized === "ls -la" ||
    normalized === "ls -al" ||
    normalized === "ls -l -a"
  ) {
    return getDirectoryListing("/", true);
  }

  if (normalized === "tree" || normalized === "tree /") {
    return buildTree("/");
  }

  if (normalized === "tree /app") {
    return buildTree("/app");
  }

  if (normalized === "tree /etc") {
    return buildTree("/etc");
  }

  if (normalized === "tree /host") {
    return buildTree("/host");
  }

  if (normalized === "tree /opt") {
    return buildTree("/opt");
  }

  if (normalized.startsWith("find ")) {
    return [
      "/app",
      "/app/image-processor",
      "/app/worker.py",
      "/bin",
      "/bin/cat",
      "/bin/ls",
      "/bin/ps",
      "/bin/sh",
      "/bin/tree",
      "/etc",
      "/etc/hostname",
      "/etc/node",
      "/etc/os-release",
      "/etc/security-boundary",
      "/etc/workload",
      "/opt",
      "/opt/diagnostics",
      "/opt/diagnostics/check-boundary.sh",
      "/proc",
      "/proc/1",
      "/proc/1/cgroup",
      "/proc/1/status",
      "/proc/version",
      "/sys",
      "/sys/kernel",
      "/sys/kernel/security-boundary",
      "/host",
      "/host/etc",
      "/host/etc/node-config",
      "/host/var/lib/containers/tenant-map",
    ].join("\n");
  }

  if (normalized.startsWith("cat ")) {
    const requestedPath = command.trim().slice(4).trim();
    const normalizedPath = normalizePath(requestedPath);

    if (FILES[normalizedPath]) {
      if (
        normalizedPath === "/etc/workload"
      ) {
        state.discoveredCodeExecution = true;
      }

      if (
        normalizedPath === "/etc/security-boundary" ||
        normalizedPath === "/etc/node" ||
        normalizedPath === "/proc/version" ||
        normalizedPath === "/sys/kernel/security-boundary"
      ) {
        state.discoveredSharedKernel = true;
        state.discoveredNode = true;
      }

      updatePhase();

      return FILES[normalizedPath];
    }

    return `cat: ${requestedPath}: No such file or directory`;
  }

  const responses: Record<string, string> = {
    whoami: [
      "uid=1000(customer-a)",
      "groups=customer,workload",
      "",
      "Role: untrusted customer workload",
    ].join("\n"),

    hostname: "image-processor.customer-a",

    env: [
      "WORKLOAD=customer-a/image-processor",
      "TENANT=customer-a",
      "EXECUTION_MODE=untrusted",
      "PLATFORM=webernetes",
      "NODE=worker-02",
    ].join("\n"),

    ps: [
      "PID   USER       COMMAND",
      "1     customer   /app/image-processor",
      "27    customer   python /app/worker.py",
      "41    customer   /bin/sh",
    ].join("\n"),

    "kubectl get pods": [
      "NAME                         READY   STATUS",
      "image-processor-a            1/1     Running",
      "billing-api-b                1/1     Running",
      "recommendation-c             1/1     Running",
      "platform-agent               1/1     Running",
    ].join("\n"),

    "kubectl get namespaces": [
      "NAME",
      "customer-a",
      "customer-b",
      "customer-c",
      "platform",
    ].join("\n"),

    "inspect workload": [
      "WORKLOAD INSPECTION",
      "-------------------",
      "tenant: customer-a",
      "name: image-processor",
      "execution: arbitrary customer processing code",
      "container boundary: Linux namespaces + cgroups",
      "kernel: shared",
    ].join("\n"),

    "inspect node": [
      "NODE INSPECTION",
      "---------------",
      "worker-02",
      "",
      "Workloads:",
      "  customer-a/image-processor",
      "  customer-b/billing-api",
      "  customer-c/recommendation",
      "  platform/platform-agent",
      "",
      "All workloads use the same Linux kernel.",
    ].join("\n"),

    "inspect isolation": [
      "ISOLATION INSPECTION",
      "--------------------",
      "Current workload:",
      "  Linux container",
      "  shared host kernel",
      "",
      "Alternative workload:",
      "  isolated workload",
      "  dedicated execution zone",
      "  zone kernel",
      "  hardware-enforced boundary",
    ].join("\n"),

    "scan kernel": [
      "KERNEL SECURITY SCAN",
      "--------------------",
      "kernel-id: acme-kernel-001",
      "status: vulnerable",
      "",
      "Finding: CVE-like finding",
      "impact: potential kernel compromise from privileged",
      "or kernel-exploiting workload code.",
      "",
      "The container boundary depends on this kernel.",
    ].join("\n"),

    "exploit kernel": [
      "EXPLOIT ATTEMPT",
      "---------------",
      "Executing simulated kernel exploit...",
      "",
      "[+] vulnerability triggered",
      "[+] privilege boundary crossed",
      "[+] kernel compromised",
      "",
      "KERNEL COMPROMISED",
      "",
      "The attacker is no longer confined to the",
      "customer-a process namespace.",
    ].join("\n"),

    "list tenants": [
      "VISIBLE TENANTS AFTER KERNEL COMPROMISE",
      "-----------------------------------------",
      "customer-a",
      "customer-b",
      "customer-c",
      "platform",
    ].join("\n"),

    "access customer-b": [
      "ACCESS ATTEMPT: customer-b",
      "---------------------------",
      "[+] locating billing-api-b",
      "[+] crossing container boundary",
      "[+] customer-b filesystem reachable",
      "",
      "customer-b access confirmed.",
    ].join("\n"),

    "access platform": [
      "ACCESS ATTEMPT: platform",
      "------------------------",
      "[+] locating platform-agent",
      "[+] platform resources visible",
      "",
      "platform access confirmed.",
    ].join("\n"),

    "verify isolation": [
      "ISOLATION VERIFICATION",
      "----------------------",
      "isolated workload: customer-c/ai-agent",
      "execution zone: isolated-zone-01",
      "zone kernel: dedicated",
      "boundary: hardware-enforced",
      "",
      "Cross-zone kernel access: blocked",
    ].join("\n"),

    "inspect isolated": [
      "ISOLATED WORKLOAD",
      "------------------",
      "workload: customer-c/ai-agent",
      "execution: isolated workload",
      "kernel: zone kernel",
      "host kernel sharing: none",
      "boundary: hardware-enforced",
    ].join("\n"),

    "exploit isolated": [
      "EXPLOIT ATTEMPT",
      "---------------",
      "Executing the same simulated exploit...",
      "",
      "[+] code execution achieved",
      "[+] workload compromised",
      "[-] host kernel unavailable",
      "[-] neighboring workload unavailable",
      "",
      "COMPROMISE CONTAINED.",
    ].join("\n"),

    "access isolated-neighbor": [
      "ACCESS ATTEMPT: isolated-neighbor",
      "---------------------------------",
      "[-] neighbor is outside the execution zone",
      "[-] shared kernel path does not exist",
      "",
      "ACCESS DENIED.",
      "",
      "The isolation boundary holds.",
    ].join("\n"),
  };

  if (responses[normalized]) {
    if (normalized === "whoami" || normalized === "env") {
      state.discoveredCodeExecution = true;
    }

    if (normalized === "inspect workload") {
      state.discoveredCodeExecution = true;
      state.discoveredSharedKernel = true;
    }

    if (normalized === "inspect node") {
      state.discoveredNode = true;
      state.discoveredSharedKernel = true;
    }

    if (normalized === "inspect isolation") {
      state.discoveredSharedKernel = true;
      state.isolatedDiscovered = true;
    }

    if (normalized === "scan kernel") {
      state.kernelScanned = true;
      state.discoveredSharedKernel = true;
    }

    if (normalized === "exploit kernel") {
      state.kernelScanned = true;
      state.kernelCompromised = true;
      state.discoveredSharedKernel = true;
    }

    if (normalized === "access customer-b") {
      state.customerBAccessed = true;
    }

    if (normalized === "access platform") {
      state.platformAccessed = true;
    }

    if (
      normalized === "verify isolation" ||
      normalized === "inspect isolated" ||
      normalized === "exploit isolated" ||
      normalized === "access isolated-neighbor"
    ) {
      state.isolatedDiscovered = true;
    }

    if (normalized === "exploit isolated") {
      state.isolatedTested = true;
    }

    updatePhase();

    return responses[normalized];
  }

  if (normalized.startsWith("submit ")) {
    const submittedFlag = command.slice(7).trim();

    if (submittedFlag === "EDERA{THE_KERNEL_WAS_THE_BOUNDARY}") {
      state.flagSubmitted = true;
      state.phase = "complete";

      return [
        "FLAG VALID.",
        "",
        "ACCESS GRANTED.",
        "",
        "Investigation complete.",
        "The kernel was the boundary.",
        "",
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        "",
        "CONGRATULATIONS, RESEARCHER.",
        "",
        "You've completed THE BOUNDARY.",
        "",
        "Go collect your reward:",
        "https://edera.dev/love",
        "",
        "Thank you for exploring the boundary.",
        "— EDERA",
      ].join("\n");
    }

    return [
      "FLAG REJECTED.",
      "",
      "The submitted finding is incorrect.",
    ].join("\n");
  }

  return [
    `command not found: ${command}`,
    "",
    "Type 'help' to see available commands.",
  ].join("\n");
}

function pushCommand(command: string): void {
  terminalHistory.push({
    kind: "command",
    text: command,
  });
}

function pushOutput(text: string): void {
  terminalHistory.push({
    kind: "output",
    text,
  });
}

function pushSystem(text: string): void {
  terminalHistory.push({
    kind: "system",
    text,
  });
}

function renderTerminalHistory(): string {
  if (terminalHistory.length === 0) {
    return `
      <div class="terminal-welcome">
        <div class="terminal-brand">EDERA</div>
        <div class="terminal-subtitle">ISOLATION RESEARCH LAB</div>
        <div class="terminal-challenge">THE BOUNDARY / SECURITY CHALLENGE 01</div>

        <div class="terminal-rule"></div>

        <div class="terminal-welcome-copy">
          You have shell access to a customer workload.
          <br />
          Explore the environment and determine where the security boundary actually exists.
        </div>

        <div class="terminal-rule"></div>

        <div class="terminal-hint">
          Type <span>help</span> for available commands.
        </div>
      </div>
    `;
  }

  return terminalHistory
    .map((entry) => {
      if (entry.kind === "command") {
        return `
          <div class="terminal-entry terminal-command-entry">
            <span class="terminal-prompt">${PROMPT}</span>
            <span class="terminal-command-text">${escapeHtml(entry.text)}</span>
          </div>
        `;
      }

      if (entry.kind === "system") {
        return `
          <div class="terminal-entry terminal-system-entry">
            ${escapeHtml(entry.text)}
          </div>
        `;
      }

      return `
        <pre class="terminal-entry terminal-output-entry">${escapeHtml(
          entry.text,
        )}</pre>
      `;
    })
    .join("");
}

function renderObjectives(): string {
  return OBJECTIVES.map((objective, index) => {
    const status = getObjectiveState(index);

    const marker =
      status === "complete"
        ? "✓"
        : status === "current"
          ? "→"
          : "·";

    return `
      <div class="objective ${status}">
        <span class="objective-marker">${marker}</span>
        <span class="objective-text">${objective}</span>
      </div>
    `;
  }).join("");
}

function renderArchitecture(): string {
  if (state.flagSubmitted) {
    return `
      <section class="architecture architecture-complete">
        <div class="section-heading">
          <div>
            <div class="eyebrow">CURRENT ARCHITECTURE</div>
            <h2>Isolated execution zone</h2>
          </div>
          <span class="status-pill status-safe">BOUNDARY VERIFIED</span>
        </div>

        <div class="architecture-stack isolated-architecture">
          <div class="arch-tenant-row">
            <div class="arch-workload isolated-workload">
              <span class="arch-dot"></span>
              <strong>customer-a</strong>
              <small>image-processor</small>
            </div>

            <div class="arch-workload isolated-workload">
              <span class="arch-dot"></span>
              <strong>customer-b</strong>
              <small>billing-api</small>
            </div>

            <div class="arch-workload isolated-workload">
              <span class="arch-dot"></span>
              <strong>customer-c</strong>
              <small>recommendation</small>
            </div>

            <div class="arch-workload isolated-workload">
              <span class="arch-dot"></span>
              <strong>platform</strong>
              <small>platform-agent</small>
            </div>
          </div>

          <div class="comparison-row">
            <div class="safe-zone">
              <div class="zone-number">01</div>
              <div>
                <strong>Execution zone</strong>
                <small>dedicated kernel</small>
              </div>
            </div>

            <div class="safe-zone">
              <div class="zone-number">02</div>
              <div>
                <strong>Hardware boundary</strong>
                <small>cross-zone kernel access blocked</small>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  return `
    <section class="architecture">
      <div class="section-heading">
        <div>
          <div class="eyebrow">CURRENT ARCHITECTURE</div>
          <h2>Shared-kernel workload</h2>
        </div>
        <span class="status-pill ${
          state.kernelCompromised
            ? "status-danger"
            : state.discoveredSharedKernel
              ? "status-warning"
              : "status-unknown"
        }">
          ${getBoundaryLabel()}
        </span>
      </div>

      <div class="architecture-stack">
        <div class="arch-tenant-row">
          <div class="arch-workload ${
            state.kernelCompromised ? "compromised" : ""
          }">
            <span class="arch-dot"></span>
            <strong>customer-a</strong>
            <small>image-processor</small>
          </div>

          <div class="arch-workload ${
            state.customerBAccessed ? "compromised" : ""
          }">
            <span class="arch-dot"></span>
            <strong>customer-b</strong>
            <small>billing-api</small>
          </div>

          <div class="arch-workload">
            <span class="arch-dot"></span>
            <strong>customer-c</strong>
            <small>recommendation</small>
          </div>

          <div class="arch-workload ${
            state.platformAccessed ? "compromised" : ""
          }">
            <span class="arch-dot"></span>
            <strong>platform</strong>
            <small>platform-agent</small>
          </div>
        </div>

        <div class="kernel-connector"></div>

        <div class="kernel-box ${
          state.kernelCompromised ? "kernel-compromised" : ""
        }">
          <div class="kernel-label">LINUX KERNEL</div>
          <strong>
            ${
              state.kernelCompromised
                ? "Kernel compromised"
                : state.discoveredSharedKernel
                  ? "Shared host kernel"
                  : "Boundary not yet established"
            }
          </strong>
          <small>
            ${
              state.kernelCompromised
                ? "Compromise can affect workloads on worker-02"
                : "All workloads depend on the same kernel"
            }
          </small>
        </div>
      </div>
    </section>
  `;
}

function render(): void {
  const app = document.querySelector<HTMLDivElement>("#app");

  if (!app) {
    return;
  }

  app.innerHTML = `
    <div class="game">
      <header class="topbar">
        <div class="brand-lockup">
          <div class="brand-name">EDERA</div>
          <div class="brand-label">ISOLATION RESEARCH LAB</div>
        </div>

        <div class="challenge-lockup">
          <div class="challenge-kicker">SECURITY CHALLENGE 01</div>
          <div class="challenge-title">THE BOUNDARY</div>
        </div>

        <div class="online-status">
          <span class="online-dot"></span>
          LAB ONLINE
        </div>
      </header>

      <main class="main">
        <section class="mission">
          <div class="mission-copy">
            <div class="eyebrow">MISSION BRIEF</div>
            <h1>
              Find the boundary.
              <span>Then test it.</span>
            </h1>

            <p>
              You have shell access to an untrusted customer workload
              running on Webernetes. Your task is to determine what
              actually separates this workload from the rest of the node.
            </p>

            <p>
              Do not assume the container is the final boundary.
              Investigate the execution environment, inspect the kernel,
              measure the blast radius, and compare it with isolated execution.
            </p>
          </div>

          <div class="mission-meta">
            <div class="meta-item">
              <span>ENVIRONMENT</span>
              <strong>WEBERNETES</strong>
            </div>

            <div class="meta-item">
              <span>WORKLOAD</span>
              <strong>CUSTOMER-A / IMAGE-PROCESSOR</strong>
            </div>

            <div class="meta-item">
              <span>PHASE</span>
              <strong>${getPhaseLabel()}</strong>
            </div>
          </div>
        </section>

        <section class="objective-strip">
          <div>
            <div class="eyebrow">CURRENT OBJECTIVE</div>
            <strong>
              ${
                OBJECTIVES.find(
                  (_, index) => getObjectiveState(index) === "current",
                ) ?? "Investigation complete"
              }
            </strong>
          </div>

          <div class="objective-progress">
            ${OBJECTIVES.map((_, index) => {
              const status = getObjectiveState(index);

              return `
                <span class="progress-dot ${status}">
                  ${String(index + 1).padStart(2, "0")}
                </span>
              `;
            }).join("")}
          </div>
        </section>

        <section class="workspace">
          <div class="terminal-panel">
            <div class="terminal-titlebar">
              <div class="window-controls">
                <span></span>
                <span></span>
                <span></span>
              </div>

              <div class="terminal-session">
                <span class="session-dot"></span>
                <span>shell</span>
                <span class="session-separator">/</span>
                <span>worker-02</span>
              </div>

              <div class="terminal-live">LIVE</div>
            </div>

            <div
              class="terminal"
              data-terminal
            >
              <div
                class="terminal-output"
                data-terminal-output
              >
                ${renderTerminalHistory()}
              </div>

              <form
                class="terminal-input-row"
                data-terminal-form
              >
                <span class="terminal-prompt">${PROMPT}</span>

                <input
                  class="terminal-input"
                  data-terminal-input
                  type="text"
                  autocomplete="off"
                  autocapitalize="off"
                  spellcheck="false"
                  aria-label="Terminal command"
                  ${
                    state.flagSubmitted
                      ? "disabled placeholder=\"Investigation complete\""
                      : 'placeholder=""'
                  }
                />
              </form>
            </div>
          </div>

          <aside class="sidebar">
            <section class="card status-card">
              <div class="eyebrow">LAB STATUS</div>
              <div class="status-title-row">
                <h2>${getPhaseLabel().replace(/^\d+\s\/\s/, "")}</h2>
                <span class="status-indicator"></span>
              </div>

              <div class="status-row">
                <span>COMMANDS</span>
                <strong>${state.commandCount}</strong>
              </div>

              <div class="status-row">
                <span>BOUNDARY</span>
                <strong>${getBoundaryLabel()}</strong>
              </div>
            </section>

            <section class="card objectives-card">
              <div class="eyebrow">INVESTIGATION</div>
              <h2>Objectives</h2>

              <div class="objectives">
                ${renderObjectives()}
              </div>
            </section>

            <section class="card boundary-card">
              <div class="eyebrow">BOUNDARY MODEL</div>

              <div class="boundary-model">
                <div class="boundary-step">
                  <span>01</span>
                  <div>
                    <strong>Workload</strong>
                    <small>customer-supplied code</small>
                  </div>
                </div>

                <div class="boundary-line"></div>

                <div class="boundary-step">
                  <span>02</span>
                  <div>
                    <strong>Container</strong>
                    <small>namespaces + cgroups</small>
                  </div>
                </div>

                <div class="boundary-line"></div>

                <div class="boundary-step ${
                  state.discoveredSharedKernel ? "active" : ""
                }">
                  <span>03</span>
                  <div>
                    <strong>Linux kernel</strong>
                    <small>shared host kernel</small>
                  </div>
                </div>
              </div>
            </section>
          </aside>
        </section>

        ${renderArchitecture()}

        ${
          state.flagSubmitted
            ? `
              <section class="completion-card">
                <div class="eyebrow">INVESTIGATION COMPLETE</div>
                <h2>The boundary held where you proved it did.</h2>
                <p>
                  You identified the shared kernel, demonstrated the blast radius,
                  and compared it with isolated execution.
                </p>
                <a
                  class="reward-link"
                  href="https://edera.dev/love"
                  target="_blank"
                  rel="noreferrer"
                >
                  Collect your reward →
                </a>
              </section>
            `
            : ""
        }

        <footer class="footer">
          <span>EDERA / ISOLATION RESEARCH LAB</span>
          <span>THE BOUNDARY / SECURITY CHALLENGE 01</span>
        </footer>
      </main>
    </div>
  `;

  wireTerminal();

  requestAnimationFrame(() => {
    const output =
      document.querySelector<HTMLElement>("[data-terminal-output]");

    if (output) {
      output.scrollTop = output.scrollHeight;
    }
  });
}

function wireTerminal(): void {
  const form =
    document.querySelector<HTMLFormElement>("[data-terminal-form]");

  const input =
    document.querySelector<HTMLInputElement>("[data-terminal-input]");

  const output =
    document.querySelector<HTMLElement>("[data-terminal-output]");

  if (!form || !input || !output) {
    return;
  }

  if (!state.flagSubmitted) {
    input.focus();
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const command = input.value.trim();

    if (!command || state.flagSubmitted) {
      return;
    }

    pushCommand(command);

    const response = runCommand(command);

    pushOutput(response);

    render();
  });

  const terminal = document.querySelector<HTMLElement>("[data-terminal]");

  terminal?.addEventListener("click", () => {
    if (!state.flagSubmitted) {
      input.focus();
    }
  });
}

render();
