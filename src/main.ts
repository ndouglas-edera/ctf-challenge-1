import "./style.css";

type GamePhase =
  | "briefing"
  | "investigation"
  | "kernel"
  | "blast-radius"
  | "isolation"
  | "complete";

type Environment = "customer-workload" | "isolated-zone";

interface GameState {
  phase: GamePhase;
  environment: Environment;
  cwd: string;

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
  text: string;
  className: string;
}

interface VirtualFile {
  path: string;
  kind: "file" | "directory";
  owner: string;
  group: string;
  mode: string;
  executable?: boolean;
  content?: string;
}

const state: GameState = {
  phase: "briefing",
  environment: "customer-workload",
  cwd: "/home/customer",

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

const FLAG = "EDERA{THE_KERNEL_WAS_THE_BOUNDARY}";

// -----------------------------------------------------------------------------
// Virtual filesystem
// -----------------------------------------------------------------------------

const CUSTOMER_FILES: VirtualFile[] = [
  {
    path: "/",
    kind: "directory",
    owner: "root",
    group: "root",
    mode: "drwxr-xr-x",
  },
  ...[
    "/app",
    "/bin",
    "/dev",
    "/etc",
    "/home",
    "/home/customer",
    "/proc",
    "/sys",
    "/tmp",
    "/opt",
    "/opt/diagnostics",
    "/opt/tools",
    "/var",
    "/var/log",
  ].map((path) => ({
    path,
    kind: "directory" as const,
    owner: path.startsWith("/home") ? "customer" : "root",
    group: path.startsWith("/home") ? "customer" : "root",
    mode: "drwxr-xr-x",
  })),

  {
    path: "/home/customer/.profile",
    kind: "file",
    owner: "customer",
    group: "customer",
    mode: "-rw-r--r--",
    content: [
      "# customer shell profile",
      "export TENANT=customer-a",
      "export WORKLOAD=image-processor",
      "export EXECUTION_MODE=untrusted",
    ].join("\n"),
  },

  {
    path: "/home/customer/workload.yaml",
    kind: "file",
    owner: "customer",
    group: "customer",
    mode: "-rw-r--r--",
    content: [
      "apiVersion: v1",
      "kind: Workload",
      "metadata:",
      "  name: image-processor",
      "  namespace: customer-a",
      "spec:",
      "  executionMode: untrusted",
      "  customerCode: enabled",
      "  isolation: container",
    ].join("\n"),
  },

  {
    path: "/app/image-processor",
    kind: "file",
    owner: "customer",
    group: "customer",
    mode: "-rwxr-xr-x",
    executable: true,
    content: [
      "#!/bin/sh",
      "",
      "# Image processing worker",
      "# Executes customer-supplied processing code.",
      "",
      "python /app/worker.py",
    ].join("\n"),
  },

  {
    path: "/app/worker.py",
    kind: "file",
    owner: "customer",
    group: "customer",
    mode: "-rw-r--r--",
    content: [
      "import os",
      "",
      "print('image processor ready')",
      "",
      "# customer-supplied processing hooks",
      "def process(image):",
      "    return image",
    ].join("\n"),
  },

  {
    path: "/bin/sh",
    kind: "file",
    owner: "root",
    group: "root",
    mode: "-rwxr-xr-x",
    executable: true,
    content: "#!/bin/sh",
  },

  {
    path: "/bin/cat",
    kind: "file",
    owner: "root",
    group: "root",
    mode: "-rwxr-xr-x",
    executable: true,
    content: "#!/bin/sh",
  },

  {
    path: "/bin/ps",
    kind: "file",
    owner: "root",
    group: "root",
    mode: "-rwxr-xr-x",
    executable: true,
    content: "#!/bin/sh",
  },

  {
    path: "/etc/hostname",
    kind: "file",
    owner: "root",
    group: "root",
    mode: "-rw-r--r--",
    content: "image-processor.customer-a",
  },

  {
    path: "/etc/workload",
    kind: "file",
    owner: "root",
    group: "root",
    mode: "-r--r--r--",
    content: [
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
  },

  {
    path: "/etc/security-boundary",
    kind: "file",
    owner: "root",
    group: "root",
    mode: "-r--r--r--",
    content: [
      "SECURITY BOUNDARY",
      "-----------------",
      "isolation: Linux containers",
      "process namespaces: enabled",
      "filesystem isolation: enabled",
      "network namespace: enabled",
      "",
      "WARNING:",
      "Containers share the host Linux kernel.",
    ].join("\n"),
  },

  {
    path: "/etc/node",
    kind: "file",
    owner: "root",
    group: "root",
    mode: "-r--r--r--",
    content: [
      "NODE INFORMATION",
      "----------------",
      "node: worker-02",
      "runtime: containerd",
      "kernel: Linux 6.x",
      "kernel-id: acme-kernel-001",
      "",
      "Multiple customer workloads run on this node.",
    ].join("\n"),
  },

  {
    path: "/proc/version",
    kind: "file",
    owner: "root",
    group: "root",
    mode: "-r--r--r--",
    content:
      "Linux version 6.8.0-acme (builder@acme-infra) #1 SMP PREEMPT_DYNAMIC",
  },

  {
    path: "/proc/hostname",
    kind: "file",
    owner: "root",
    group: "root",
    mode: "-r--r--r--",
    content: "worker-02",
  },

  {
    path: "/proc/1/status",
    kind: "file",
    owner: "root",
    group: "root",
    mode: "-r--r--r--",
    content: [
      "Name:\timage-processor",
      "State:\tS (sleeping)",
      "Pid:\t1",
      "Uid:\t1000\t1000\t1000\t1000",
      "Gid:\t1000\t1000\t1000\t1000",
    ].join("\n"),
  },

  {
    path: "/proc/1/cgroup",
    kind: "file",
    owner: "root",
    group: "root",
    mode: "-r--r--r--",
    content: [
      "0::/kubepods.slice/customer-a/image-processor",
      "",
      "Container namespace:",
      "customer-a/image-processor",
    ].join("\n"),
  },

  {
    path: "/proc/self/cgroup",
    kind: "file",
    owner: "root",
    group: "root",
    mode: "-r--r--r--",
    content: "0::/kubepods.slice/customer-a/image-processor",
  },

  {
    path: "/proc/cpuinfo",
    kind: "file",
    owner: "root",
    group: "root",
    mode: "-r--r--r--",
    content: [
      "processor\t: 0",
      "vendor_id\t: GenuineVirtual",
      "model name\t: Edera Virtual CPU",
      "cpu cores\t: 4",
    ].join("\n"),
  },

  {
    path: "/proc/meminfo",
    kind: "file",
    owner: "root",
    group: "root",
    mode: "-r--r--r--",
    content: [
      "MemTotal:       8388608 kB",
      "MemFree:        4217088 kB",
      "MemAvailable:   5632000 kB",
    ].join("\n"),
  },

  {
    path: "/opt/diagnostics/node-info.sh",
    kind: "file",
    owner: "root",
    group: "root",
    mode: "-rwxr-xr-x",
    executable: true,
    content: [
      "#!/bin/sh",
      "cat /etc/node",
      "cat /proc/version",
    ].join("\n"),
  },

  {
    path: "/opt/diagnostics/check-boundary.sh",
    kind: "file",
    owner: "root",
    group: "root",
    mode: "-rwxr-xr-x",
    executable: true,
    content: [
      "#!/bin/sh",
      "",
      "echo '=== SECURITY BOUNDARY ==='",
      "cat /etc/security-boundary",
      "",
      "echo '=== NODE ==='",
      "cat /etc/node",
      "",
      "echo '=== WORKLOADS ==='",
      "kubectl get pods",
    ].join("\n"),
  },

  {
    path: "/opt/diagnostics/kernel-check",
    kind: "file",
    owner: "root",
    group: "root",
    mode: "-rwxr-xr-x",
    executable: true,
    content: [
      "#!/bin/sh",
      "echo 'Kernel diagnostic'",
      "uname -a",
      "cat /proc/version",
    ].join("\n"),
  },

  {
    path: "/opt/tools/tenant-map",
    kind: "file",
    owner: "root",
    group: "root",
    mode: "-rwxr-xr-x",
    executable: true,
    content: [
      "#!/bin/sh",
      "kubectl get namespaces",
      "kubectl get pods",
    ].join("\n"),
  },

  {
    path: "/var/log/workload.log",
    kind: "file",
    owner: "root",
    group: "root",
    mode: "-rw-r--r--",
    content: [
      "worker-02/image-processor started",
      "container runtime: containerd",
      "tenant: customer-a",
      "execution mode: untrusted",
    ].join("\n"),
  },
];

const HOST_FILES: VirtualFile[] = [
  {
    path: "/host",
    kind: "directory",
    owner: "root",
    group: "root",
    mode: "drwxr-xr-x",
  },
  {
    path: "/host/etc",
    kind: "directory",
    owner: "root",
    group: "root",
    mode: "drwxr-xr-x",
  },
  {
    path: "/host/etc/node-config",
    kind: "file",
    owner: "root",
    group: "root",
    mode: "-rw-r--r--",
    content: [
      "NODE CONFIGURATION",
      "------------------",
      "node=worker-02",
      "kernel-id=acme-kernel-001",
      "runtime=containerd",
      "orchestrator=webernetes",
      "tenant-density=4",
    ].join("\n"),
  },
  {
    path: "/host/var",
    kind: "directory",
    owner: "root",
    group: "root",
    mode: "drwxr-xr-x",
  },
  {
    path: "/host/var/lib",
    kind: "directory",
    owner: "root",
    group: "root",
    mode: "drwxr-xr-x",
  },
  {
    path: "/host/var/lib/kubelet",
    kind: "directory",
    owner: "root",
    group: "root",
    mode: "drwxr-xr-x",
  },
  {
    path: "/host/var/lib/kubelet/pods",
    kind: "directory",
    owner: "root",
    group: "root",
    mode: "drwxr-xr-x",
  },
  ...["customer-a", "customer-b", "customer-c", "platform"].map(
    (tenant) => ({
      path: `/host/var/lib/kubelet/pods/${tenant}`,
      kind: "directory" as const,
      owner: "root",
      group: "root",
      mode: "drwxr-xr-x",
    }),
  ),
  {
    path: "/host/var/lib/containers",
    kind: "directory",
    owner: "root",
    group: "root",
    mode: "drwxr-xr-x",
  },
  {
    path: "/host/var/lib/containers/tenant-map",
    kind: "file",
    owner: "root",
    group: "root",
    mode: "-rw-r--r--",
    content: [
      "customer-a=image-processor",
      "customer-b=billing-api",
      "customer-c=recommendation",
      "platform=platform-agent",
    ].join("\n"),
  },
];

const ISOLATED_FILES: VirtualFile[] = [
  {
    path: "/",
    kind: "directory",
    owner: "root",
    group: "root",
    mode: "drwxr-xr-x",
  },

  ...[
    "/bin",
    "/dev",
    "/etc",
    "/home",
    "/home/customer",
    "/home/customer/app",
    "/home/customer/scripts",
    "/proc",
    "/opt",
    "/tmp",
    "/var",
  ].map((path) => ({
    path,
    kind: "directory" as const,
    owner: path.startsWith("/home") ? "customer" : "root",
    group: path.startsWith("/home") ? "customer" : "root",
    mode: "drwxr-xr-x",
  })),

  {
    path: "/etc/workload",
    kind: "file",
    owner: "root",
    group: "root",
    mode: "-r--r--r--",
    content: [
      "WORKLOAD PROFILE",
      "----------------",
      "tenant=customer-c",
      "application=ai-agent",
      "execution_mode=untrusted",
      "trust_level=customer-supplied-code",
    ].join("\n"),
  },

  {
    path: "/etc/security-boundary",
    kind: "file",
    owner: "root",
    group: "root",
    mode: "-r--r--r--",
    content: [
      "ISOLATION",
      "---------",
      "type=isolated-execution-zone",
      "kernel=dedicated",
      "host_kernel=none",
      "hardware_boundary=enabled",
      "neighbor_access=blocked",
    ].join("\n"),
  },

  {
    path: "/etc/node",
    kind: "file",
    owner: "root",
    group: "root",
    mode: "-r--r--r--",
    content: [
      "EXECUTION ZONE",
      "--------------",
      "zone=isolated-zone-01",
      "kernel=zone-kernel-01",
      "host_kernel=none",
      "hardware_boundary=enabled",
    ].join("\n"),
  },

  {
    path: "/home/customer/app/ai-agent",
    kind: "file",
    owner: "customer",
    group: "customer",
    mode: "-rwxr-xr-x",
    executable: true,
    content: [
      "#!/bin/sh",
      "",
      "# Customer AI agent",
      "# Executes untrusted agent code inside an isolated zone.",
      "",
      "echo 'agent ready'",
    ].join("\n"),
  },

  {
    path: "/home/customer/scripts/check-boundary.sh",
    kind: "file",
    owner: "customer",
    group: "customer",
    mode: "-rwxr-xr-x",
    executable: true,
    content: [
      "#!/bin/sh",
      "cat /etc/security-boundary",
      "cat /etc/node",
    ].join("\n"),
  },

  {
    path: "/proc/version",
    kind: "file",
    owner: "root",
    group: "root",
    mode: "-r--r--r--",
    content:
      "Linux version 6.8.0-edera-zone (zone@isolated-runtime) #1 SMP",
  },
];

// -----------------------------------------------------------------------------
// Filesystem helpers
// -----------------------------------------------------------------------------

function activeFilesystem(): VirtualFile[] {
  if (state.environment === "isolated-zone") {
    return ISOLATED_FILES;
  }

  const files = [...CUSTOMER_FILES];

  if (state.kernelCompromised) {
    files.push(...HOST_FILES);
  }

  return files;
}

function normalizePath(input: string, base = state.cwd): string {
  let path = input.trim();

  if (!path) {
    return base;
  }

  if (path === "~") {
    return "/home/customer";
  }

  if (path.startsWith("~/")) {
    path = `/home/customer/${path.slice(2)}`;
  } else if (!path.startsWith("/")) {
    path = `${base}/${path}`;
  }

  const normalized: string[] = [];

  for (const part of path.split("/")) {
    if (!part || part === ".") {
      continue;
    }

    if (part === "..") {
      normalized.pop();
      continue;
    }

    normalized.push(part);
  }

  return `/${normalized.join("/")}` || "/";
}

function getFile(path: string): VirtualFile | undefined {
  return activeFilesystem().find(
    (file) => file.path === normalizePath(path),
  );
}

function directoryExists(path: string): boolean {
  return getFile(path)?.kind === "directory";
}

function fileExists(path: string): boolean {
  return Boolean(getFile(path));
}

function directoryEntries(path: string): VirtualFile[] {
  const normalized = normalizePath(path);

  return activeFilesystem().filter((file) => {
    if (file.path === normalized) {
      return false;
    }

    const parent =
      file.path.slice(0, file.path.lastIndexOf("/")) || "/";

    return parent === normalized;
  });
}

function relativeName(path: string, parent: string): string {
  if (parent === "/") {
    return path.slice(1);
  }

  return path.slice(parent.length + 1);
}

function displayPath(path: string): string {
  if (path === "/home/customer") {
    return "~";
  }

  if (path.startsWith("/home/customer/")) {
    return `~/${path.slice("/home/customer/".length)}`;
  }

  return path;
}

// -----------------------------------------------------------------------------
// Terminal helpers
// -----------------------------------------------------------------------------

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function promptText(): string {
  if (state.environment === "isolated-zone") {
    return `customer-c@ai-agent:${displayPath(state.cwd)}$`;
  }

  return `customer-a@image-processor:${displayPath(state.cwd)}$`;
}

function addHistory(
  text: string,
  className = "terminal-response",
): void {
  terminalHistory.push({
    text,
    className,
  });
}

function addCommandHistory(command: string): void {
  terminalHistory.push({
    text: `${promptText()} ${command}`,
    className: "terminal-command",
  });
}

function renderWelcome(): string {
  return `
    <div class="terminal-welcome">
      <div class="terminal-brand-mark">EDERA</div>

      <div class="terminal-system">
        ISOLATION RESEARCH LAB
      </div>

      <div class="terminal-muted">
        THE BOUNDARY / SECURITY CHALLENGE 01
      </div>

      <div class="terminal-divider"></div>

      <div>
        You have shell access to a customer workload.
      </div>

      <div>
        Explore the environment and determine where the
        security boundary actually exists.
      </div>

      <div class="terminal-divider"></div>

      <div class="terminal-muted">
        Type <span class="command-highlight">help</span>
        for available commands.
      </div>
    </div>
  `;
}

function renderHistory(): string {
  if (terminalHistory.length === 0) {
    return renderWelcome();
  }

  return terminalHistory
    .map(
      (entry) =>
        `<pre class="terminal-line ${entry.className}">${escapeHtml(
          entry.text,
        )}</pre>`,
    )
    .join("");
}

// -----------------------------------------------------------------------------
// Shell parsing
// -----------------------------------------------------------------------------

function tokenize(command: string): string[] {
  return command
    .replace(/2>\/dev\/null/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function commandName(command: string): string {
  return tokenize(command)[0] ?? "";
}

function commandArguments(command: string): string[] {
  return tokenize(command).slice(1);
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

function stripFlags(args: string[]): string[] {
  return args.filter((arg) => !arg.startsWith("-"));
}

// -----------------------------------------------------------------------------
// Shell commands
// -----------------------------------------------------------------------------

function shellHelp(): string {
  return [
    "EDERA / ISOLATION RESEARCH LAB",
    "THE BOUNDARY — SECURITY CHALLENGE 01",
    "",
    "SHELL",
    "  pwd                         show current directory",
    "  ls [path]                   list directory",
    "  ls -la [path]               detailed directory listing",
    "  tree [path]                 inspect filesystem tree",
    "  cd <path>                   change directory",
    "  cat <file>                  read a file",
    "  find <path>                 find files",
    "  whoami                      identify the workload user",
    "  hostname                    identify the workload",
    "  env                         inspect environment",
    "  ps                          inspect processes",
    "  uname -a                    inspect kernel",
    "",
    "WORKLOAD",
    "  cat /etc/workload",
    "  cat /etc/security-boundary",
    "  cat /etc/node",
    "  cat /proc/version",
    "  cat /app/worker.py",
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
    "SUBMIT",
    "  submit <flag>",
  ].join("\n");
}

function runLs(args: string[]): string {
  const detailed = hasFlag(args, "-l") || hasFlag(args, "-la") ||
    hasFlag(args, "-al");
  const paths = stripFlags(args);
  const target = normalizePath(paths[0] ?? state.cwd);

  const file = getFile(target);

  if (!file) {
    return `ls: cannot access '${paths[0] ?? target}': No such file or directory`;
  }

  if (file.kind === "file") {
    if (detailed) {
      return `${file.mode} 1 ${file.owner} ${file.group}  ${file.path}`;
    }

    return relativeName(file.path, state.cwd);
  }

  const entries = directoryEntries(target).sort((a, b) => {
    if (a.kind !== b.kind) {
      return a.kind === "directory" ? -1 : 1;
    }

    return a.path.localeCompare(b.path);
  });

  if (!detailed) {
    return entries
      .map((entry) =>
        entry.kind === "directory"
          ? `${relativeName(entry.path, target)}/`
          : relativeName(entry.path, target),
      )
      .join("  ");
  }

  const lines = [
    `total ${entries.length * 4}`,
    `drwxr-xr-x  1 root     root     4096 .`,
    `drwxr-xr-x  1 root     root     4096 ..`,
  ];

  for (const entry of entries) {
    lines.push(
      [
        entry.mode,
        "1",
        entry.owner.padEnd(8),
        entry.group.padEnd(8),
        "4096",
        relativeName(entry.path, target),
      ].join(" "),
    );
  }

  return lines.join("\n");
}

function buildTree(path: string, prefix = ""): string {
  const target = normalizePath(path);

  if (!directoryExists(target)) {
    return `tree: '${path}': No such directory`;
  }

  const entries = directoryEntries(target).sort((a, b) => {
    if (a.kind !== b.kind) {
      return a.kind === "directory" ? -1 : 1;
    }

    return a.path.localeCompare(b.path);
  });

  const lines: string[] = [target === "/" ? "/" : relativeName(target, "/")];

  entries.forEach((entry, index) => {
    const last = index === entries.length - 1;
    const branch = last ? "└── " : "├── ";
    const childPrefix = prefix + (last ? "    " : "│   ");

    lines.push(
      `${prefix}${branch}${relativeName(entry.path, target)}${
        entry.kind === "directory" ? "/" : ""
      }`,
    );

    if (entry.kind === "directory") {
      const nested = buildTree(entry.path, childPrefix)
        .split("\n")
        .slice(1);

      lines.push(...nested.map((line) => `${line}`));
    }
  });

  return lines.join("\n");
}

function runFind(args: string[]): string {
  const target = normalizePath(
    stripFlags(args)[0] ?? state.cwd,
  );

  if (!directoryExists(target)) {
    return `find: '${target}': No such file or directory`;
  }

  return activeFilesystem()
    .filter(
      (file) =>
        file.path === target ||
        file.path.startsWith(`${target}/`),
    )
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((file) => file.path)
    .join("\n");
}

function runCat(args: string[]): string {
  const path = args[0];

  if (!path) {
    return "cat: missing operand";
  }

  const normalized = normalizePath(path);
  const file = getFile(normalized);

  if (!file) {
    return `cat: ${path}: No such file or directory`;
  }

  if (file.kind === "directory") {
    return `cat: ${path}: Is a directory`;
  }

  return file.content ?? "";
}

function runCd(args: string[]): string {
  const target = normalizePath(args[0] ?? "~");

  if (!directoryExists(target)) {
    return `cd: ${args[0] ?? target}: No such directory`;
  }

  state.cwd = target;
  return "";
}

function runUname(): string {
  return [
    "Linux image-processor 6.8.0-acme",
    "#1 SMP PREEMPT_DYNAMIC",
    "x86_64 GNU/Linux",
  ].join(" ");
}

function runWhoami(): string {
  return [
    "uid=1000(customer-a)",
    "groups=customer,workload",
    "",
    "Role: untrusted customer workload",
  ].join("\n");
}

function runEnv(): string {
  return [
    "WORKLOAD=customer-a/image-processor",
    "TENANT=customer-a",
    "EXECUTION_MODE=untrusted",
    "PLATFORM=webernetes",
    "NODE=worker-02",
    "RUNTIME=containerd",
  ].join("\n");
}

function runPs(): string {
  return [
    "PID   USER       COMMAND",
    "1     customer   /app/image-processor",
    "27    customer   python /app/worker.py",
    "41    customer   /bin/sh",
  ].join("\n");
}

// -----------------------------------------------------------------------------
// Platform / investigation commands
// -----------------------------------------------------------------------------

function runKubectl(command: string): string {
  const args = commandArguments(command);

  if (args[0] !== "get") {
    return "kubectl: simulated command not available";
  }

  if (args[1] === "pods") {
    return [
      "NAME                         READY   STATUS",
      "image-processor-a            1/1     Running",
      "billing-api-b                1/1     Running",
      "recommendation-c             1/1     Running",
      "platform-agent               1/1     Running",
    ].join("\n");
  }

  if (args[1] === "namespaces" || args[1] === "namespace") {
    return [
      "NAME",
      "customer-a",
      "customer-b",
      "customer-c",
      "platform",
    ].join("\n");
  }

  return [
    "NAME",
    "customer-a",
    "customer-b",
    "customer-c",
    "platform",
  ].join("\n");
}

function runInspectWorkload(): string {
  state.discoveredCodeExecution = true;
  updatePhase();

  return [
    "WORKLOAD INSPECTION",
    "-------------------",
    "tenant: customer-a",
    "name: image-processor",
    "execution: arbitrary customer processing code",
    "container boundary: Linux namespaces + cgroups",
    "kernel: shared",
    "",
    "Observation:",
    "This workload is intentionally untrusted.",
    "The workload can execute customer-supplied code.",
  ].join("\n");
}

function runInspectNode(): string {
  state.discoveredNode = true;
  state.discoveredSharedKernel = true;
  updatePhase();

  return [
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
    "",
    "kernel-id: acme-kernel-001",
  ].join("\n");
}

function runInspectIsolation(): string {
  state.isolatedDiscovered = true;
  updatePhase();

  return [
    "ISOLATION INSPECTION",
    "--------------------",
    "CURRENT WORKLOAD",
    "  Linux container",
    "  process namespace",
    "  filesystem namespace",
    "  shared host kernel",
    "",
    "ALTERNATIVE WORKLOAD",
    "  isolated workload",
    "  dedicated execution zone",
    "  zone kernel",
    "  hardware-enforced boundary",
    "",
    "The important distinction is where the kernel lives.",
  ].join("\n");
}

function runScanKernel(): string {
  state.kernelScanned = true;
  state.discoveredSharedKernel = true;
  updatePhase();

  return [
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
    "",
    "Next step: determine the blast radius.",
  ].join("\n");
}

function runExploitKernel(): string {
  state.kernelCompromised = true;
  state.discoveredSharedKernel = true;
  updatePhase();

  return [
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
    "",
    "The host filesystem is now visible in the simulator.",
    "Try: ls -la /host",
  ].join("\n");
}

function runListTenants(): string {
  if (!state.kernelCompromised) {
    return [
      "ACCESS DENIED",
      "",
      "The tenant map is outside the current boundary.",
      "Investigate the kernel first.",
    ].join("\n");
  }

  return [
    "VISIBLE TENANTS AFTER KERNEL COMPROMISE",
    "-----------------------------------------",
    "customer-a",
    "customer-b",
    "customer-c",
    "platform",
  ].join("\n");
}

function runAccessCustomerB(): string {
  if (!state.kernelCompromised) {
    return [
      "ACCESS ATTEMPT: customer-b",
      "---------------------------",
      "[-] container boundary holds",
      "[-] customer-b filesystem unavailable",
      "",
      "Kernel compromise is required before this",
      "cross-tenant path exists.",
    ].join("\n");
  }

  state.customerBAccessed = true;
  updatePhase();

  return [
    "ACCESS ATTEMPT: customer-b",
    "---------------------------",
    "[+] locating billing-api-b",
    "[+] crossing container boundary",
    "[+] customer-b filesystem reachable",
    "",
    "customer-b access confirmed.",
    "",
    "Impact:",
    "A compromise of the shared kernel expands",
    "the security boundary beyond one workload.",
  ].join("\n");
}

function runAccessPlatform(): string {
  if (!state.kernelCompromised) {
    return [
      "ACCESS ATTEMPT: platform",
      "------------------------",
      "[-] platform resources are outside the container",
      "[-] shared kernel not yet compromised",
    ].join("\n");
  }

  state.platformAccessed = true;
  updatePhase();

  return [
    "ACCESS ATTEMPT: platform",
    "------------------------",
    "[+] locating platform-agent",
    "[+] platform resources visible",
    "",
    "platform access confirmed.",
    "",
    "The blast radius includes platform infrastructure.",
  ].join("\n");
}

function runVerifyIsolation(): string {
  state.isolatedDiscovered = true;
  state.isolatedTested = true;
  updatePhase();

  return [
    "ISOLATION VERIFICATION",
    "----------------------",
    "isolated workload: customer-c/ai-agent",
    "execution zone: isolated-zone-01",
    "zone kernel: dedicated",
    "boundary: hardware-enforced",
    "",
    "Cross-zone kernel access: blocked",
  ].join("\n");
}

function runInspectIsolated(): string {
  state.isolatedDiscovered = true;
  updatePhase();

  return [
    "ISOLATED WORKLOAD",
    "------------------",
    "workload: customer-c/ai-agent",
    "execution: isolated workload",
    "kernel: zone kernel",
    "host kernel sharing: none",
    "boundary: hardware-enforced",
    "",
    "The workload can still execute untrusted code.",
    "The execution environment is what changes.",
  ].join("\n");
}

function runExploitIsolated(): string {
  state.isolatedTested = true;
  updatePhase();

  return [
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
    "",
    "The workload was compromised.",
    "The isolation boundary was not.",
  ].join("\n");
}

function runAccessIsolatedNeighbor(): string {
  state.isolatedTested = true;
  updatePhase();

  return [
    "ACCESS ATTEMPT: isolated-neighbor",
    "---------------------------------",
    "[-] neighbor is outside the execution zone",
    "[-] shared kernel path does not exist",
    "",
    "ACCESS DENIED.",
    "",
    "The isolation boundary holds.",
  ].join("\n");
}

// -----------------------------------------------------------------------------
// Command engine
// -----------------------------------------------------------------------------

async function runCommand(command: string): Promise<string> {
  state.commandCount++;

  await new Promise((resolve) => setTimeout(resolve, 180));

  const normalized = command.trim().toLowerCase();

  if (!normalized) {
    return "";
  }

  const name = commandName(command);

  switch (name) {
    case "help":
      return shellHelp();

    case "pwd":
      return state.cwd;

    case "ls":
      return runLs(commandArguments(command));

    case "tree": {
      const args = commandArguments(command);
      const path = stripFlags(args)[0] ?? state.cwd;
      return buildTree(path);
    }

    case "find":
      return runFind(commandArguments(command));

    case "cat":
      return runCat(commandArguments(command));

    case "cd":
      return runCd(commandArguments(command));

    case "uname":
      return runUname();

    case "whoami":
      return runWhoami();

    case "hostname":
      return state.environment === "isolated-zone"
        ? "ai-agent.isolated-zone-01"
        : "image-processor.customer-a";

    case "env":
      return state.environment === "isolated-zone"
        ? [
            "WORKLOAD=customer-c/ai-agent",
            "TENANT=customer-c",
            "EXECUTION_MODE=untrusted",
            "PLATFORM=webernetes",
            "ZONE=isolated-zone-01",
            "KERNEL=zone-kernel-01",
          ].join("\n")
        : runEnv();

    case "ps":
      return state.environment === "isolated-zone"
        ? [
            "PID   USER       COMMAND",
            "1     customer   /home/customer/app/ai-agent",
            "19    customer   /bin/sh",
          ].join("\n")
        : runPs();

    case "kubectl":
      return runKubectl(command);

    case "inspect": {
      const args = commandArguments(command);

      if (args[0] === "workload") {
        return runInspectWorkload();
      }

      if (args[0] === "node") {
        return runInspectNode();
      }

      if (args[0] === "isolation") {
        return runInspectIsolation();
      }

      if (args[0] === "isolated") {
        return runInspectIsolated();
      }

      return [
        "Usage:",
        "  inspect workload",
        "  inspect node",
        "  inspect isolation",
        "  inspect isolated",
      ].join("\n");
    }

    case "scan":
      if (commandArguments(command)[0] === "kernel") {
        return runScanKernel();
      }

      return "Usage: scan kernel";

    case "exploit":
      if (commandArguments(command)[0] === "kernel") {
        return runExploitKernel();
      }

      if (commandArguments(command)[0] === "isolated") {
        return runExploitIsolated();
      }

      return [
        "Usage:",
        "  exploit kernel",
        "  exploit isolated",
      ].join("\n");

    case "list":
      if (commandArguments(command)[0] === "tenants") {
        return runListTenants();
      }

      return "Usage: list tenants";

    case "access": {
      const target = commandArguments(command)[0];

      if (target === "customer-b") {
        return runAccessCustomerB();
      }

      if (target === "platform") {
        return runAccessPlatform();
      }

      if (target === "isolated-neighbor") {
        return runAccessIsolatedNeighbor();
      }

      return [
        "Usage:",
        "  access customer-b",
        "  access platform",
        "  access isolated-neighbor",
      ].join("\n");
    }

    case "verify":
      if (commandArguments(command)[0] === "isolation") {
        return runVerifyIsolation();
      }

      return "Usage: verify isolation";

    case "submit": {
      const submittedFlag = command.slice(7).trim();

      if (submittedFlag === FLAG) {
        state.flagSubmitted = true;
        state.phase = "complete";

        return [
          "FLAG VALID.",
          "",
          "ACCESS GRANTED.",
          "",
          "Investigation complete.",
          "",
          "The kernel was the boundary.",
          "",
          FLAG,
        ].join("\n");
      }

      return [
        "FLAG REJECTED.",
        "",
        "The submitted finding is incorrect.",
      ].join("\n");
    }

    default:
      return [
        `command not found: ${command}`,
        "",
        "Type 'help' to see available commands.",
      ].join("\n");
  }
}

// -----------------------------------------------------------------------------
// Game progression
// -----------------------------------------------------------------------------

function updatePhase(): void {
  if (state.flagSubmitted) {
    state.phase = "complete";
    return;
  }

  if (state.isolatedTested) {
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

  if (
    state.discoveredCodeExecution ||
    state.discoveredNode ||
    state.discoveredSharedKernel
  ) {
    state.phase = "investigation";
    return;
  }

  state.phase = "briefing";
}

// -----------------------------------------------------------------------------
// UI state
// -----------------------------------------------------------------------------

function phaseLabel(): string {
  switch (state.phase) {
    case "briefing":
      return "BRIEFING";

    case "investigation":
      return "INVESTIGATION";

    case "kernel":
      return "KERNEL ANALYSIS";

    case "blast-radius":
      return "BLAST RADIUS";

    case "isolation":
      return "ISOLATION TEST";

    case "complete":
      return "COMPLETE";
  }
}

function phaseNumber(): string {
  switch (state.phase) {
    case "briefing":
      return "01";

    case "investigation":
      return "02";

    case "kernel":
      return "03";

    case "blast-radius":
      return "04";

    case "isolation":
      return "05";

    case "complete":
      return "06";
  }
}

function phaseDescription(): string {
  switch (state.phase) {
    case "briefing":
      return "Establish what the workload is allowed to execute.";

    case "investigation":
      return "Determine what actually separates this workload from the node.";

    case "kernel":
      return "Inspect the kernel dependency and test its security boundary.";

    case "blast-radius":
      return "Measure what becomes reachable after kernel compromise.";

    case "isolation":
      return "Compare the shared-kernel model with an isolated execution zone.";

    case "complete":
      return "Investigation complete. The boundary has been identified.";
  }
}

interface Objective {
  label: string;
  complete: boolean;
  current: boolean;
}

function objectives(): Objective[] {
  const investigationDone =
    state.discoveredCodeExecution &&
    state.discoveredNode &&
    state.discoveredSharedKernel;

  const blastRadiusDone =
    state.customerBAccessed && state.platformAccessed;

  const isolationDone = state.isolatedTested;

  return [
    {
      label: "Find untrusted code",
      complete: state.discoveredCodeExecution,
      current: !state.discoveredCodeExecution,
    },
    {
      label: "Identify execution boundary",
      complete: investigationDone,
      current:
        state.discoveredCodeExecution &&
        !investigationDone,
    },
    {
      label: "Investigate kernel",
      complete: state.kernelScanned,
      current:
        investigationDone && !state.kernelScanned,
    },
    {
      label: "Measure blast radius",
      complete: blastRadiusDone,
      current:
        state.kernelCompromised && !blastRadiusDone,
    },
    {
      label: "Test isolated execution",
      complete: isolationDone,
      current:
        blastRadiusDone && !isolationDone,
    },
    {
      label: "Submit finding",
      complete: state.flagSubmitted,
      current:
        isolationDone && !state.flagSubmitted,
    },
  ];
}

// -----------------------------------------------------------------------------
// Architecture visualization
// -----------------------------------------------------------------------------

function renderArchitecture(): string {
  if (state.phase === "complete") {
    return `
      <div class="architecture architecture-complete">
        <div class="architecture-header">
          <div>
            <div class="eyebrow">FINAL STATE</div>
            <h3>Isolation boundary verified</h3>
          </div>
          <span class="status-pill status-safe">CONTAINED</span>
        </div>

        <div class="comparison-row">
          <div class="comparison-card comparison-risk">
            <div class="comparison-label">SHARED KERNEL</div>
            <strong>Container workload</strong>
            <span>Compromise can cross workload boundaries.</span>
          </div>

          <div class="comparison-arrow">→</div>

          <div class="comparison-card comparison-safe">
            <div class="comparison-label">ISOLATED ZONE</div>
            <strong>Dedicated execution zone</strong>
            <span>Compromise remains inside the zone.</span>
          </div>
        </div>
      </div>
    `;
  }

  if (state.phase === "isolation") {
    return `
      <div class="architecture">
        <div class="architecture-header">
          <div>
            <div class="eyebrow">ISOLATED EXECUTION</div>
            <h3>Dedicated zone</h3>
          </div>
          <span class="status-pill status-safe">BOUNDARY HOLDS</span>
        </div>

        <div class="zone-diagram">
          <div class="arch-tenant-row">
            <div class="arch-workload">
              <span class="node-dot safe"></span>
              customer-c
              <small>ai-agent</small>
            </div>
          </div>

          <div class="arch-connector safe-connector"></div>

          <div class="arch-box isolated-box">
            <div class="arch-box-title">ISOLATED EXECUTION ZONE</div>
            <div class="arch-box-meta">
              dedicated zone kernel
            </div>
            <div class="arch-box-meta">
              hardware-enforced boundary
            </div>
          </div>

          <div class="arch-connector safe-connector"></div>

          <div class="safe-zone">
            <span class="node-dot safe"></span>
            Neighbor access blocked
          </div>
        </div>
      </div>
    `;
  }

  if (state.kernelCompromised) {
    return `
      <div class="architecture architecture-compromised">
        <div class="architecture-header">
          <div>
            <div class="eyebrow">BLAST RADIUS</div>
            <h3>Shared kernel compromised</h3>
          </div>
          <span class="status-pill status-danger">COMPROMISED</span>
        </div>

        <div class="zone-diagram">
          <div class="arch-tenant-row">
            <div class="arch-workload compromised">
              <span class="node-dot danger"></span>
              customer-a
              <small>image-processor</small>
            </div>

            <div class="arch-workload">
              <span class="node-dot danger"></span>
              customer-b
              <small>billing-api</small>
            </div>

            <div class="arch-workload">
              <span class="node-dot danger"></span>
              customer-c
              <small>recommendation</small>
            </div>

            <div class="arch-workload">
              <span class="node-dot danger"></span>
              platform
              <small>platform-agent</small>
            </div>
          </div>

          <div class="arch-connector danger-connector"></div>

          <div class="kernel-box compromised">
            <div class="arch-box-title">SHARED LINUX KERNEL</div>
            <div class="arch-box-meta">acme-kernel-001</div>
            <div class="arch-box-meta">KERNEL COMPROMISED</div>
          </div>

          <div class="blast-radius">
            <span>BLAST RADIUS</span>
            <strong>NODE + NEIGHBOR WORKLOADS</strong>
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="architecture">
      <div class="architecture-header">
        <div>
          <div class="eyebrow">CURRENT ARCHITECTURE</div>
          <h3>Shared-kernel workload</h3>
        </div>
        <span class="status-pill ${
          state.discoveredSharedKernel
            ? "status-warning"
            : "status-neutral"
        }">
          ${
            state.discoveredSharedKernel
              ? "SHARED KERNEL"
              : "UNKNOWN BOUNDARY"
          }
        </span>
      </div>

      <div class="zone-diagram">
        <div class="arch-tenant-row">
          <div class="arch-workload">
            <span class="node-dot"></span>
            customer-a
            <small>image-processor</small>
          </div>

          <div class="arch-workload">
            <span class="node-dot"></span>
            customer-b
            <small>billing-api</small>
          </div>

          <div class="arch-workload">
            <span class="node-dot"></span>
            customer-c
            <small>recommendation</small>
          </div>

          <div class="arch-workload">
            <span class="node-dot"></span>
            platform
            <small>platform-agent</small>
          </div>
        </div>

        <div class="arch-connector"></div>

        <div class="kernel-box">
          <div class="arch-box-title">
            ${state.discoveredSharedKernel
              ? "SHARED LINUX KERNEL"
              : "KERNEL"}
          </div>
          <div class="arch-box-meta">
            ${
              state.discoveredSharedKernel
                ? "acme-kernel-001"
                : "boundary not yet established"
            }
          </div>
        </div>
      </div>
    </div>
  `;
}

// -----------------------------------------------------------------------------
// Main render
// -----------------------------------------------------------------------------

function render(): void {
  const app = document.querySelector<HTMLDivElement>("#app");

  if (!app) {
    return;
  }

  const objectiveItems = objectives();

  app.innerHTML = `
    <div class="game">

      <header class="topbar">
        <div class="brand">
          <div class="brand-wordmark">EDERA</div>
          <div class="brand-subtitle">ISOLATION RESEARCH LAB</div>
        </div>

        <div class="challenge-title">
          <div class="challenge-kicker">SECURITY CHALLENGE 01</div>
          <h1>THE BOUNDARY</h1>
        </div>

        <div class="topbar-status">
          <span class="topbar-status-dot"></span>
          <span>LAB ONLINE</span>
        </div>
      </header>

      <main class="main">

        <section class="mission">
          <div class="mission-copy">
            <div class="eyebrow">MISSION BRIEF</div>

            <h2>
              Find the boundary.
              <span>Then test it.</span>
            </h2>

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
              <strong>
                ${
                  state.environment === "isolated-zone"
                    ? "CUSTOMER-C / AI-AGENT"
                    : "CUSTOMER-A / IMAGE-PROCESSOR"
                }
              </strong>
            </div>

            <div class="meta-item">
              <span>PHASE</span>
              <strong>${phaseNumber()} / ${phaseLabel()}</strong>
            </div>
          </div>
        </section>

        <section class="progress-strip">
          <div class="progress-copy">
            <span class="eyebrow">CURRENT OBJECTIVE</span>
            <strong>${phaseDescription()}</strong>
          </div>

          <div class="progress-track">
            ${objectiveItems
              .map(
                (objective, index) => `
                  <div
                    class="progress-step ${
                      objective.complete
                        ? "complete"
                        : objective.current
                          ? "current"
                          : ""
                    }"
                    title="${escapeHtml(objective.label)}"
                  >
                    <span>${String(index + 1).padStart(2, "0")}</span>
                  </div>
                `,
              )
              .join("")}
          </div>
        </section>

        <section class="workspace">

          <div class="terminal-panel">

            <div class="terminal-titlebar">
              <div class="terminal-window-controls">
                <span></span>
                <span></span>
                <span></span>
              </div>

              <div class="terminal-title">
                <span class="terminal-lock">●</span>
                shell / ${state.environment === "isolated-zone"
                  ? "isolated-zone-01"
                  : "worker-02"}
              </div>

              <div class="terminal-live">LIVE</div>
            </div>

            <div class="terminal-output" id="terminal-output">
              ${renderHistory()}
            </div>

            <form class="terminal-input" id="terminal-form">
              <span class="terminal-prompt">${escapeHtml(
                promptText(),
              )}</span>

              <input
                id="command-input"
                name="command"
                type="text"
                autocomplete="off"
                autocapitalize="off"
                spellcheck="false"
                aria-label="Terminal command"
                autofocus
              />

              <span class="terminal-cursor"></span>
            </form>

          </div>

          <aside class="sidebar">

            <section class="card status-card">
              <div class="card-heading">
                <div>
                  <div class="eyebrow">LAB STATUS</div>
                  <h3>${phaseLabel()}</h3>
                </div>

                <span class="status-dot ${
                  state.phase === "complete"
                    ? "safe"
                    : state.kernelCompromised
                      ? "danger"
                      : "active"
                }"></span>
              </div>

              <div class="status-detail">
                <span>COMMANDS</span>
                <strong>${state.commandCount}</strong>
              </div>

              <div class="status-detail">
                <span>BOUNDARY</span>
                <strong>
                  ${
                    state.kernelCompromised
                      ? "COMPROMISED"
                      : state.discoveredSharedKernel
                        ? "SHARED KERNEL"
                        : "UNKNOWN"
                  }
                </strong>
              </div>
            </section>

            <section class="card objectives-card">
              <div class="card-heading">
                <div>
                  <div class="eyebrow">INVESTIGATION</div>
                  <h3>Objectives</h3>
                </div>
              </div>

              <div class="objectives">
                ${objectiveItems
                  .map(
                    (objective) => `
                      <div class="objective ${
                        objective.complete
                          ? "complete"
                          : objective.current
                            ? "current"
                            : ""
                      }">
                        <span class="objective-marker">
                          ${
                            objective.complete
                              ? "✓"
                              : objective.current
                                ? "→"
                                : "·"
                          }
                        </span>

                        <span>${escapeHtml(objective.label)}</span>
                      </div>
                    `,
                  )
                  .join("")}
              </div>
            </section>

            <section class="card boundary-card">
              <div class="eyebrow">BOUNDARY MODEL</div>

              <div class="boundary-stack">

                <div class="boundary-layer">
                  <span class="layer-number">01</span>
                  <div>
                    <strong>Workload</strong>
                    <small>customer-supplied code</small>
                  </div>
                </div>

                <div class="boundary-line ${
                  state.discoveredCodeExecution ? "lit" : ""
                }"></div>

                <div class="boundary-layer">
                  <span class="layer-number">02</span>
                  <div>
                    <strong>Container</strong>
                    <small>namespaces + cgroups</small>
                  </div>
                </div>

                <div class="boundary-line ${
                  state.discoveredSharedKernel ? "warning" : ""
                }"></div>

                <div class="boundary-layer ${
                  state.kernelCompromised ? "danger-layer" : ""
                }">
                  <span class="layer-number">03</span>
                  <div>
                    <strong>Linux kernel</strong>
                    <small>
                      ${
                        state.kernelCompromised
                          ? "compromised"
                          : "shared host kernel"
                      }
                    </small>
                  </div>
                </div>

              </div>
            </section>

          </aside>

        </section>

        <section class="architecture-panel">
          ${renderArchitecture()}
        </section>

        <section class="lower-grid">

          <section class="card guide-card">
            <div class="eyebrow">FIELD NOTES</div>
            <h3>Start with discovery.</h3>

            <p>
              Treat the terminal like a real workload. Inspect files,
              processes, namespaces, the node, and the kernel before
              attempting the simulated exploit.
            </p>

            <div class="command-hints">
              <code>ls -la</code>
              <code>tree /</code>
              <code>cat /etc/workload</code>
              <code>cat /etc/security-boundary</code>
              <code>cat /etc/node</code>
            </div>
          </section>

          <section class="card isolation-card">
            <div class="eyebrow">KEY QUESTION</div>

            <h3>
              What happens when the kernel is part of the boundary?
            </h3>

            <p>
              The challenge is not simply whether a workload can be
              compromised. It is whether that compromise can reach
              another trust domain.
            </p>

            <div class="isolation-callout">
              <span class="callout-mark">+</span>
              <span>
                Compare the shared-kernel workload with the isolated
                execution zone before submitting your finding.
              </span>
            </div>
          </section>

        </section>

        <footer class="footer">
          <span>EDERA / THE BOUNDARY</span>
          <span>SECURITY CHALLENGE 01</span>
          <span>WEBERNETES SIMULATION</span>
        </footer>

      </main>
    </div>
  `;

  wireTerminal();

  requestAnimationFrame(() => {
    const output =
      document.querySelector<HTMLDivElement>("#terminal-output");

    if (output) {
      output.scrollTop = output.scrollHeight;
    }

    document
      .querySelector<HTMLInputElement>("#command-input")
      ?.focus();
  });
}

// -----------------------------------------------------------------------------
// Terminal interaction
// -----------------------------------------------------------------------------

function wireTerminal(): void {
  const form =
    document.querySelector<HTMLFormElement>("#terminal-form");

  const input =
    document.querySelector<HTMLInputElement>("#command-input");

  if (!form || !input) {
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const command = input.value.trim();

    if (!command) {
      return;
    }

    input.disabled = true;

    addCommandHistory(command);

    const response = await runCommand(command);

    if (response) {
      const className =
        command.toLowerCase().startsWith("submit ")
          ? state.flagSubmitted
            ? "terminal-success"
            : "terminal-error"
          : command.toLowerCase().includes("exploit")
            ? state.kernelCompromised
              ? "terminal-danger"
              : "terminal-response"
            : "terminal-response";

      addHistory(response, className);
    }

    updatePhase();
    render();
  });
}

// -----------------------------------------------------------------------------
// Boot
// -----------------------------------------------------------------------------

render();
