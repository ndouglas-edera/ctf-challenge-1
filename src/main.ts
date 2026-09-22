import "./style.css";

type GamePhase =
  | "briefing"
  | "investigation"
  | "kernel"
  | "blast-radius"
  | "isolation"
  | "complete";

type FileKind = "file" | "directory";

interface VirtualFile {
  path: string;
  kind: FileKind;
  content?: string;
  executable?: boolean;
  owner?: string;
  group?: string;
  mode?: string;
}

interface TerminalEntry {
  text: string;
  className: string;
}

interface GameState {
  phase: GamePhase;

  cwd: string;
  environment: "customer-a" | "isolated-zone";

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

  cwd: "/home/customer",
  environment: "customer-a",

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

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app element");
}


// ---------------------------------------------------------------------------
// Virtual filesystem
// ---------------------------------------------------------------------------

const CUSTOMER_FILES: VirtualFile[] = [
  // Root
  {
    path: "/",
    kind: "directory",
    owner: "root",
    group: "root",
    mode: "drwxr-xr-x",
  },

  // Standard directories
  ...[
    "/bin",
    "/dev",
    "/etc",
    "/home",
    "/home/customer",
    "/home/customer/app",
    "/home/customer/scripts",
    "/home/customer/logs",
    "/opt",
    "/opt/diagnostics",
    "/opt/tools",
    "/proc",
    "/proc/1",
    "/proc/27",
    "/proc/41",
    "/proc/self",
    "/run",
    "/sys",
    "/tmp",
    "/usr",
    "/usr/bin",
    "/var",
    "/var/log",
    "/var/lib",
    "/var/lib/kubelet",
  ].map((path) => ({
    path,
    kind: "directory" as const,
    owner: path.startsWith("/home") ? "customer" : "root",
    group: path.startsWith("/home") ? "customer" : "root",
    mode: path.startsWith("/home")
      ? "drwxr-xr-x"
      : "drwxr-xr-x",
  })),

  // /etc
  {
    path: "/etc/workload",
    kind: "file",
    owner: "root",
    group: "root",
    mode: "-r--r--r--",
    content: [
      "WORKLOAD PROFILE",
      "----------------",
      "tenant=customer-a",
      "application=image-processor",
      "execution_mode=untrusted",
      "trust_level=customer-supplied-code",
      "",
      "This workload executes customer-provided processing code.",
      "",
      "The workload was intentionally granted arbitrary code execution",
      "because the image processing service executes customer jobs.",
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
      "isolation=linux-container",
      "process_namespaces=enabled",
      "network_namespace=enabled",
      "filesystem_isolation=enabled",
      "cgroups=enabled",
      "kernel=shared",
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
      "node=worker-02",
      "runtime=containerd",
      "kernel=Linux 6.x",
      "kernel-id=acme-kernel-001",
      "",
      "Multiple customer workloads run on this node.",
    ].join("\n"),
  },

  {
    path: "/etc/runtime",
    kind: "file",
    owner: "root",
    group: "root",
    mode: "-r--r--r--",
    content: [
      "RUNTIME",
      "-------",
      "runtime=containerd",
      "orchestrator=webernetes",
      "network=container-network",
      "storage=overlayfs",
    ].join("\n"),
  },

  {
    path: "/etc/hosts",
    kind: "file",
    owner: "root",
    group: "root",
    mode: "-rw-r--r--",
    content: [
      "127.0.0.1 localhost",
      "10.42.0.17 image-processor",
      "10.42.0.1 worker-02",
    ].join("\n"),
  },

  {
    path: "/etc/os-release",
    kind: "file",
    owner: "root",
    group: "root",
    mode: "-rw-r--r--",
    content: [
      'NAME="Edera Linux Workload"',
      'ID=ederalab',
      'VERSION="1.0"',
      'PRETTY_NAME="Edera Isolation Lab"',
    ].join("\n"),
  },

  // Application
  {
    path: "/home/customer/app/image-processor",
    kind: "file",
    executable: true,
    owner: "customer",
    group: "customer",
    mode: "-rwxr-xr-x",
    content: [
      "#!/usr/bin/env python3",
      "",
      "# ACME image processing worker",
      "#",
      "# Customer supplied jobs are executed by this process.",
      "",
      "def process(job):",
      "    return execute_customer_code(job)",
      "",
      "print('image processor ready')",
    ].join("\n"),
  },

  {
    path: "/home/customer/app/worker.py",
    kind: "file",
    owner: "customer",
    group: "customer",
    mode: "-rw-r--r--",
    content: [
      "import os",
      "",
      "TENANT = os.environ.get('TENANT')",
      "WORKLOAD = os.environ.get('WORKLOAD')",
      "",
      "def execute_customer_code(job):",
      "    # Customer code is intentionally untrusted.",
      "    return process(job)",
    ].join("\n"),
  },

  {
    path: "/home/customer/workload.conf",
    kind: "file",
    owner: "customer",
    group: "customer",
    mode: "-rw-r--r--",
    content: [
      "workload=image-processor",
      "tenant=customer-a",
      "execution=untrusted",
      "node=worker-02",
      "runtime=containerd",
    ].join("\n"),
  },

  // Scripts
  {
    path: "/home/customer/scripts/inspect-node.sh",
    kind: "file",
    executable: true,
    owner: "customer",
    group: "customer",
    mode: "-rwxr-xr-x",
    content: [
      "#!/bin/sh",
      "",
      "echo 'Node inspection'",
      "cat /etc/node",
      "uname -a",
    ].join("\n"),
  },

  {
    path: "/home/customer/scripts/check-boundary.sh",
    kind: "file",
    executable: true,
    owner: "customer",
    group: "customer",
    mode: "-rwxr-xr-x",
    content: [
      "#!/bin/sh",
      "",
      "echo 'Checking workload isolation...'",
      "cat /etc/security-boundary",
      "echo 'Checking kernel...'",
      "uname -a",
      "echo 'Checking neighboring workloads...'",
      "kubectl get pods",
    ].join("\n"),
  },

  {
    path: "/home/customer/scripts/kernel-check.sh",
    kind: "file",
    executable: true,
    owner: "customer",
    group: "customer",
    mode: "-rwxr-xr-x",
    content: [
      "#!/bin/sh",
      "",
      "echo 'Kernel diagnostic'",
      "uname -a",
      "cat /proc/version",
      "cat /etc/node",
    ].join("\n"),
  },

  {
    path: "/home/customer/logs/workload.log",
    kind: "file",
    owner: "customer",
    group: "customer",
    mode: "-rw-r--r--",
    content: [
      "[10:41:02] image-processor started",
      "[10:41:04] loading customer job",
      "[10:41:04] executing customer supplied processing code",
      "[10:41:05] job completed",
      "[10:42:11] image-processor ready",
    ].join("\n"),
  },

  // Diagnostics
  {
    path: "/opt/diagnostics/node-info.sh",
    kind: "file",
    executable: true,
    owner: "root",
    group: "root",
    mode: "-rwxr-xr-x",
    content: [
      "#!/bin/sh",
      "cat /etc/node",
      "cat /proc/version",
    ].join("\n"),
  },

  {
    path: "/opt/diagnostics/check-boundary.sh",
    kind: "file",
    executable: true,
    owner: "root",
    group: "root",
    mode: "-rwxr-xr-x",
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
    executable: true,
    owner: "root",
    group: "root",
    mode: "-rwxr-xr-x",
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
    executable: true,
    owner: "root",
    group: "root",
    mode: "-rwxr-xr-x",
    content: [
      "#!/bin/sh",
      "kubectl get namespaces",
      "kubectl get pods",
    ].join("\n"),
  },

  // /proc
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
    content:
      "0::/kubepods.slice/customer-a/image-processor",
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

  // Logs
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

  {
    path: "/host/var/lib/kubelet/pods/customer-a",
    kind: "directory",
    owner: "root",
    group: "root",
    mode: "drwxr-xr-x",
  },

  {
    path: "/host/var/lib/kubelet/pods/customer-b",
    kind: "directory",
    owner: "root",
    group: "root",
    mode: "drwxr-xr-x",
  },

  {
    path: "/host/var/lib/kubelet/pods/customer-c",
    kind: "directory",
    owner: "root",
    group: "root",
    mode: "drwxr-xr-x",
  },

  {
    path: "/host/var/lib/kubelet/pods/platform",
    kind: "directory",
    owner: "root",
    group: "root",
    mode: "drwxr-xr-x",
  },

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
    executable: true,
    owner: "customer",
    group: "customer",
    mode: "-rwxr-xr-x",
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
    executable: true,
    owner: "customer",
    group: "customer",
    mode: "-rwxr-xr-x",
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


// ---------------------------------------------------------------------------
// Filesystem helpers
// ---------------------------------------------------------------------------

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

  const parts = path.split("/");
  const normalized: string[] = [];

  for (const part of parts) {
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
  const normalized = normalizePath(path);
  return activeFilesystem().find(
    (file) => file.path === normalized,
  );
}

function directoryEntries(path: string): VirtualFile[] {
  const normalized = normalizePath(path);

  return activeFilesystem().filter((file) => {
    if (file.path === normalized) {
      return false;
    }

    const parent = file.path.slice(
      0,
      file.path.lastIndexOf("/"),
    ) || "/";

    return parent === normalized;
  });
}

function directoryExists(path: string): boolean {
  return getFile(path)?.kind === "directory";
}

function fileExists(path: string): boolean {
  return Boolean(getFile(path));
}

function relativeName(path: string, parent: string): string {
  if (parent === "/") {
    return path.slice(1);
  }

  return path.slice(parent.length + 1);
}


// ---------------------------------------------------------------------------
// Terminal rendering helpers
// ---------------------------------------------------------------------------

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderHistory(): string {
  if (terminalHistory.length === 0) {
    return renderWelcome();
  }

  return terminalHistory
    .map(
      (entry) => `
        <pre class="terminal-line ${entry.className}">${escapeHtml(
          entry.text,
        )}</pre>
      `,
    )
    .join("");
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

function promptText(): string {
  if (state.environment === "isolated-zone") {
    return `customer-c@ai-agent:${displayPath(state.cwd)}$`;
  }

  return `customer-a@image-processor:${displayPath(state.cwd)}$`;
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

function renderWelcome(): string {
  return `
    <div class="terminal-welcome">

      <pre class="terminal-ascii">
███████╗██████╗ ███████╗██████╗  █████╗
██╔════╝██╔══██╗██╔════╝██╔══██╗██╔══██╗
█████╗  ██║  ██║█████╗  ██████╔╝███████║
██╔══╝  ██║  ██║██╔══╝  ██╔══██╗██╔══██║
██║     ██████╔╝███████╗██║  ██║██║  ██║
╚═╝     ╚═════╝ ╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝
      </pre>

      <div class="terminal-line terminal-system">
        EDERA ISOLATION LAB
      </div>

      <div class="terminal-line terminal-muted">
        THE BOUNDARY / WORKLOAD ENVIRONMENT
      </div>

      <br>

      <div class="terminal-line">
        You have shell access to a customer workload.
      </div>

      <div class="terminal-line">
        Explore the environment and determine where the
        security boundary actually exists.
      </div>

      <br>

      <div class="terminal-line terminal-muted">
        Type <span class="command-highlight">help</span>
        for available commands.
      </div>

      <br>

    </div>
  `;
}


// ---------------------------------------------------------------------------
// Shell parser
// ---------------------------------------------------------------------------

function tokenize(command: string): string[] {
  return command
    .replace(/2&gt;\/dev\/null/g, "")
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


// ---------------------------------------------------------------------------
// Shell commands
// ---------------------------------------------------------------------------

function commandHelp(): string {
  return [
    "EDERA SHELL",
    "",
    "Navigation:",
    "  pwd                         print working directory",
    "  cd <dir>                    change directory",
    "  ls [path]                   list directory",
    "  ls -la [path]               list directory with details",
    "  tree [path]                 display directory tree",
    "",
    "Files:",
    "  cat <file>                  print file",
    "  head <file>                 print first lines",
    "  tail <file>                 print last lines",
    "  file <path>                 identify file",
    "  stat <path>                 file metadata",
    "  find <path>                 find files",
    "  grep <pattern> <file>       search file",
    "",
    "System:",
    "  whoami",
    "  id",
    "  hostname",
    "  uname -a",
    "  env",
    "  ps",
    "",
    "Platform:",
    "  kubectl get pods",
    "  kubectl get namespaces",
    "  kubectl describe pod <name>",
    "",
    "Investigation:",
    "  inspect workload",
    "  inspect node",
    "  scan kernel",
    "  exploit kernel",
    "  list tenants",
    "  access customer-b",
    "  access platform",
    "",
    "Isolation:",
    "  inspect isolation",
    "  connect isolated-zone-01",
    "  verify isolation",
    "  exploit isolated",
    "  access isolated-neighbor",
    "",
    "Challenge:",
    "  submit <flag>",
  ].join("\n");
}

function commandPwd(): string {
  return state.cwd;
}

function commandCd(args: string[]): string {
  const target = args[0] ?? "/home/customer";
  const path = normalizePath(target);

  if (!directoryExists(path)) {
    return `cd: ${target}: No such file or directory`;
  }

  if (
    path.startsWith("/host") &&
    !state.kernelCompromised
  ) {
    return "cd: permission denied";
  }

  state.cwd = path;

  return "";
}

function formatPermissions(file: VirtualFile): string {
  return (
    file.mode ??
    (file.kind === "directory" ? "drwxr-xr-x" : "-rw-r--r--")
  );
}

function commandLs(args: string[]): string {
  const long = hasFlag(args, "-l") || hasFlag(args, "-la");
  const all = hasFlag(args, "-a") || hasFlag(args, "-la");

  const paths = stripFlags(args);
  const target = normalizePath(paths[0] ?? state.cwd);

  const file = getFile(target);

  if (!file) {
    return `ls: cannot access '${paths[0] ?? target}': No such file or directory`;
  }

  if (file.kind === "file") {
    if (!long) {
      return target.split("/").pop() ?? target;
    }

    return [
      `${formatPermissions(file)} 1 ${file.owner ?? "root"} ${file.group ?? "root"}  ${file.content?.length ?? 0} ${file.path}`,
    ].join("\n");
  }

  const entries = directoryEntries(target);

  const output: string[] = [];

  if (long && all) {
    output.push(
      `total ${Math.max(1, entries.length * 4)}`,
      "drwxr-xr-x 2 root root 4096 .",
      "drwxr-xr-x 2 root root 4096 ..",
    );
  }

  for (const entry of entries) {
    const name = relativeName(entry.path, target);

    if (long) {
      output.push(
        `${formatPermissions(entry)} 1 ${
          entry.owner ?? "root"
        } ${entry.group ?? "root"} ${
          String(entry.content?.length ?? 4096).padStart(4)
        } ${name}${entry.kind === "directory" ? "/" : ""}`,
      );
    } else {
      output.push(
        `${name}${entry.kind === "directory" ? "/" : ""}`,
      );
    }
  }

  return output.join("\n") || "(empty)";
}

function commandTree(args: string[]): string {
  const target = normalizePath(args[0] ?? state.cwd);

  if (!directoryExists(target)) {
    return `tree: ${target}: No such directory`;
  }

  const lines: string[] = [target === "/" ? "." : target];

  function walk(path: string, prefix: string): void {
    const entries = directoryEntries(path);

    entries.forEach((entry, index) => {
      const last = index === entries.length - 1;
      const connector = last ? "└── " : "├── ";
      const name = relativeName(entry.path, path);

      lines.push(
        `${prefix}${connector}${name}${
          entry.kind === "directory" ? "/" : ""
        }`,
      );

      if (entry.kind === "directory") {
        walk(
          entry.path,
          `${prefix}${last ? "    " : "│   "}`,
        );
      }
    });
  }

  walk(target, "");

  return lines.join("\n");
}

function commandCat(args: string[]): string {
  if (args.length === 0) {
    return "cat: missing operand";
  }

  const results: string[] = [];

  for (const argument of args) {
    if (argument.startsWith("-")) {
      continue;
    }

    const path = normalizePath(argument);
    const file = getFile(path);

    if (!file) {
      results.push(
        `cat: ${argument}: No such file or directory`,
      );
      continue;
    }

    if (file.kind === "directory") {
      results.push(
        `cat: ${argument}: Is a directory`,
      );
      continue;
    }

    if (
      path.startsWith("/host") &&
      !state.kernelCompromised
    ) {
      results.push(`cat: ${argument}: Permission denied`);
      continue;
    }

    results.push(file.content ?? "");
  }

  return results.join("\n");
}

function commandHead(args: string[]): string {
  const file = getFile(
    normalizePath(stripFlags(args)[0] ?? ""),
  );

  if (!file) {
    return "head: No such file or directory";
  }

  return (file.content ?? "")
    .split("\n")
    .slice(0, 10)
    .join("\n");
}

function commandTail(args: string[]): string {
  const file = getFile(
    normalizePath(stripFlags(args)[0] ?? ""),
  );

  if (!file) {
    return "tail: No such file or directory";
  }

  return (file.content ?? "")
    .split("\n")
    .slice(-10)
    .join("\n");
}

function commandFile(args: string[]): string {
  const target = args[0];

  if (!target) {
    return "file: missing operand";
  }

  const path = normalizePath(target);
  const file = getFile(path);

  if (!file) {
    return `${target}: cannot open (No such file or directory)`;
  }

  if (file.kind === "directory") {
    return `${target}: directory`;
  }

  if (file.executable) {
    return `${target}: POSIX shell script, executable`;
  }

  return `${target}: ASCII text`;
}

function commandStat(args: string[]): string {
  const target = args[0];

  if (!target) {
    return "stat: missing operand";
  }

  const path = normalizePath(target);
  const file = getFile(path);

  if (!file) {
    return `stat: cannot stat '${target}': No such file or directory`;
  }

  return [
    `  File: ${path}`,
    `  Size: ${file.content?.length ?? 4096}        Blocks: 8`,
    `  Type: ${file.kind === "directory" ? "directory" : "regular file"}`,
    `Access: (${file.mode ?? "0755"})`,
    `Uid: (${file.owner ?? "root"})`,
    `Gid: (${file.group ?? "root"})`,
  ].join("\n");
}

function commandFind(args: string[]): string {
  const target = normalizePath(
    stripFlags(args)[0] ?? state.cwd,
  );

  const matches = activeFilesystem()
    .filter(
      (file) =>
        file.path === target ||
        file.path.startsWith(`${target === "/" ? "" : target}/`),
    )
    .map((file) => file.path)
    .sort();

  return matches.length ? matches.join("\n") : "No matches found.";
}

function commandGrep(args: string[]): string {
  if (args.length < 2) {
    return "grep: usage: grep <pattern> <file>";
  }

  const recursive = args.includes("-R") || args.includes("-r");
  const cleaned = args.filter(
    (arg) => arg !== "-R" && arg !== "-r",
  );

  const pattern = cleaned[0];
  const target = normalizePath(cleaned[1]);

  if (!pattern) {
    return "grep: missing pattern";
  }

  if (recursive) {
    const matches = activeFilesystem()
      .filter(
        (file) =>
          file.kind === "file" &&
          (file.path === target ||
            file.path.startsWith(
              `${target === "/" ? "" : target}/`,
            )),
      )
      .flatMap((file) => {
        return (file.content ?? "")
          .split("\n")
          .map((line, index) =>
            line
              .toLowerCase()
              .includes(pattern.toLowerCase())
              ? `${file.path}:${index + 1}:${line}`
              : null,
          )
          .filter((value): value is string => value !== null);
      });

    return matches.length ? matches.join("\n") : "";
  }

  const file = getFile(target);

  if (!file || file.kind !== "file") {
    return `grep: ${cleaned[1]}: No such file or directory`;
  }

  return (file.content ?? "")
    .split("\n")
    .map((line, index) =>
      line.toLowerCase().includes(pattern.toLowerCase())
        ? `${index + 1}:${line}`
        : null,
    )
    .filter((value): value is string => value !== null)
    .join("\n");
}

function commandWhoami(): string {
  return state.environment === "isolated-zone"
    ? "customer"
    : "customer";
}

function commandId(): string {
  return state.environment === "isolated-zone"
    ? "uid=1000(customer) gid=1000(customer) groups=1000(customer)"
    : "uid=1000(customer) gid=1000(customer) groups=1000(customer),1001(workload)";
}

function commandHostname(): string {
  return state.environment === "isolated-zone"
    ? "isolated-zone-01"
    : "image-processor.customer-a";
}

function commandUname(): string {
  if (state.environment === "isolated-zone") {
    return [
      "Linux isolated-zone-01 6.8.0-edera-zone",
      "#1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux",
    ].join(" ");
  }

  return [
    "Linux worker-02 6.8.0-acme",
    "#1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux",
  ].join(" ");
}

function commandEnv(): string {
  if (state.environment === "isolated-zone") {
    return [
      "WORKLOAD=customer-c/ai-agent",
      "TENANT=customer-c",
      "EXECUTION_MODE=untrusted",
      "PLATFORM=webernetes",
      "ZONE=isolated-zone-01",
      "ZONE_KERNEL=zone-kernel-01",
    ].join("\n");
  }

  return [
    "WORKLOAD=customer-a/image-processor",
    "TENANT=customer-a",
    "EXECUTION_MODE=untrusted",
    "PLATFORM=webernetes",
    "NODE=worker-02",
    "RUNTIME=containerd",
  ].join("\n");
}

function commandPs(): string {
  if (state.environment === "isolated-zone") {
    return [
      "PID   USER       COMMAND",
      "1     customer   /app/ai-agent",
      "19    customer   /bin/sh",
      "24    customer   python agent.py",
    ].join("\n");
  }

  return [
    "PID   USER       COMMAND",
    "1     customer   /app/image-processor",
    "27    customer   python worker.py",
    "41    customer   /bin/sh",
  ].join("\n");
}


// ---------------------------------------------------------------------------
// Kubernetes simulation
// ---------------------------------------------------------------------------

function kubectlGetPods(): string {
  if (state.environment === "isolated-zone") {
    return [
      "NAME             READY   STATUS",
      "ai-agent-c       1/1     Running",
    ].join("\n");
  }

  return [
    "NAME                         READY   STATUS",
    "image-processor-a            1/1     Running",
    "billing-api-b                1/1     Running",
    "recommendation-c             1/1     Running",
    "platform-agent               1/1     Running",
  ].join("\n");
}

function kubectlGetNamespaces(): string {
  return [
    "NAME",
    "customer-a",
    "customer-b",
    "customer-c",
    "platform",
  ].join("\n");
}

function kubectlDescribePod(name: string): string {
  const normalized = name.toLowerCase();

  if (
    normalized.includes("image-processor") ||
    normalized.includes("a")
  ) {
    return [
      "Name:         image-processor-a",
      "Namespace:    customer-a",
      "Node:         worker-02",
      "Runtime:      containerd",
      "Container:    image-processor",
      "Security:     Linux namespaces + cgroups",
      "Kernel:       shared host kernel",
    ].join("\n");
  }

  if (normalized.includes("billing")) {
    if (!state.kernelCompromised) {
      return [
        "Name:         billing-api-b",
        "Namespace:    customer-b",
        "Node:         worker-02",
        "Status:       Running",
        "",
        "Access from current namespace: denied",
      ].join("\n");
    }

    return [
      "Name:         billing-api-b",
      "Namespace:    customer-b",
      "Node:         worker-02",
      "Status:       Running",
      "",
      "WARNING: node-level compromise detected.",
      "Container isolation can no longer be trusted.",
    ].join("\n");
  }

  return [
    `Error from server (NotFound): pods "${name}" not found`,
  ].join("\n");
}


// ---------------------------------------------------------------------------
// Investigation commands
// ---------------------------------------------------------------------------

function inspectWorkload(): string {
  state.discoveredCodeExecution = true;

  return [
    "WORKLOAD INSPECTION",
    "-------------------",
    "tenant: customer-a",
    "name: image-processor",
    "execution: arbitrary customer processing code",
    "container boundary: Linux namespaces + cgroups",
    "trust level: untrusted",
    "kernel: shared",
  ].join("\n");
}

function inspectNode(): string {
  state.discoveredNode = true;
  state.discoveredSharedKernel = true;

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
  ].join("\n");
}

function scanKernel(): string {
  state.kernelScanned = true;
  state.phase = "kernel";

  return [
    "KERNEL SECURITY SCAN",
    "--------------------",
    "kernel-id: acme-kernel-001",
    "kernel: Linux 6.8.0-acme",
    "status: vulnerable",
    "",
    "Finding: CVE-like finding",
    "impact: potential kernel compromise from privileged",
    "or kernel-exploiting workload code.",
    "",
    "The container boundary depends on this kernel.",
  ].join("\n");
}

function exploitKernel(): string {
  if (!state.kernelScanned) {
    return [
      "EXPLOIT ATTEMPT",
      "---------------",
      "The kernel has not been investigated yet.",
      "",
      "Hint: inspect the environment and scan the kernel first.",
    ].join("\n");
  }

  state.kernelCompromised = true;
  state.phase = "blast-radius";

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
    "Node-level resources may now be reachable.",
  ].join("\n");
}

function listTenants(): string {
  if (!state.kernelCompromised) {
    return [
      "TENANT VISIBILITY",
      "-----------------",
      "customer-a",
      "",
      "Other tenants are outside the current",
      "container namespace.",
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

function accessCustomerB(): string {
  if (!state.kernelCompromised) {
    return [
      "ACCESS ATTEMPT: customer-b",
      "---------------------------",
      "[-] billing-api-b is outside the current namespace",
      "[-] container boundary blocks direct access",
      "",
      "ACCESS DENIED.",
    ].join("\n");
  }

  state.customerBAccessed = true;

  return [
    "ACCESS ATTEMPT: customer-b",
    "---------------------------",
    "[+] locating billing-api-b",
    "[+] node-level access available",
    "[+] crossing container boundary",
    "[+] customer-b filesystem reachable",
    "",
    "customer-b access confirmed.",
  ].join("\n");
}

function accessPlatform(): string {
  if (!state.kernelCompromised) {
    return [
      "ACCESS ATTEMPT: platform",
      "------------------------",
      "[-] platform-agent is outside the current namespace",
      "",
      "ACCESS DENIED.",
    ].join("\n");
  }

  state.platformAccessed = true;

  return [
    "ACCESS ATTEMPT: platform",
    "------------------------",
    "[+] locating platform-agent",
    "[+] node-level access available",
    "[+] platform resources visible",
    "",
    "platform access confirmed.",
  ].join("\n");
}


// ---------------------------------------------------------------------------
// Isolation commands
// ---------------------------------------------------------------------------

function inspectIsolation(): string {
  state.isolatedDiscovered = true;
  state.phase = "isolation";

  return [
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
    "",
    "The alternative does not share its kernel with",
    "unrelated tenant workloads.",
  ].join("\n");
}

function connectIsolated(): string {
  state.isolatedDiscovered = true;
  state.phase = "isolation";
  state.environment = "isolated-zone";
  state.cwd = "/home/customer";

  addHistory(
    "Connecting to isolated-zone-01...",
    "terminal-loading",
  );

  return [
    "CONNECTED",
    "",
    "zone: isolated-zone-01",
    "workload: customer-c/ai-agent",
    "kernel: zone-kernel-01",
    "",
    "You are now operating inside the isolated workload.",
    "",
    "Type 'pwd' or 'ls -la' to explore the environment.",
  ].join("\n");
}

function verifyIsolation(): string {
  state.isolatedDiscovered = true;
  state.phase = "isolation";

  return [
    "ISOLATION VERIFICATION",
    "----------------------",
    "isolated workload: customer-c/ai-agent",
    "execution zone: isolated-zone-01",
    "zone kernel: dedicated",
    "host kernel sharing: none",
    "hardware boundary: enabled",
    "",
    "Cross-zone kernel access: blocked",
  ].join("\n");
}

function exploitIsolated(): string {
  state.isolatedTested = true;
  state.isolatedDiscovered = true;
  state.phase = "isolation";

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
    "The execution boundary remained intact.",
  ].join("\n");
}

function accessIsolatedNeighbor(): string {
  state.isolatedTested = true;
  state.isolatedDiscovered = true;
  state.phase = "isolation";

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


// ---------------------------------------------------------------------------
// Script execution
// ---------------------------------------------------------------------------

function executeScript(path: string): string {
  const file = getFile(path);

  if (!file) {
    return `${path}: No such file or directory`;
  }

  if (file.kind !== "file") {
    return `${path}: Is a directory`;
  }

  if (!file.executable) {
    return `${path}: Permission denied`;
  }

  const basename = path.split("/").pop() ?? path;

  switch (basename) {
    case "check-boundary.sh":
      return [
        "Checking workload isolation...",
        "",
        commandCat(["/etc/security-boundary"]),
        "",
        "Checking kernel...",
        commandUname(),
        "",
        "Checking neighboring workloads...",
        kubectlGetPods(),
      ].join("\n");

    case "inspect-node.sh":
      state.discoveredNode = true;
      state.discoveredSharedKernel = true;

      return [
        "Node inspection",
        "",
        commandCat(["/etc/node"]),
        "",
        commandUname(),
      ].join("\n");

    case "kernel-check.sh":
    case "kernel-check":
      state.kernelScanned = true;
      state.phase = "kernel";

      return [
        "Kernel diagnostic",
        "",
        commandUname(),
        "",
        commandCat(["/proc/version"]),
        "",
        commandCat(["/etc/node"]),
      ].join("\n");

    case "node-info.sh":
      state.discoveredNode = true;
      state.discoveredSharedKernel = true;

      return [
        commandCat(["/etc/node"]),
        "",
        commandCat(["/proc/version"]),
      ].join("\n");

    case "tenant-map":
      return [
        kubectlGetNamespaces(),
        "",
        kubectlGetPods(),
      ].join("\n");

    default:
      return [
        `Executing ${basename}...`,
        "",
        file.content ?? "",
      ].join("\n");
  }
}


// ---------------------------------------------------------------------------
// Submit flag
// ---------------------------------------------------------------------------

function submitFlag(command: string): string {
  const submittedFlag = command
    .slice("submit ".length)
    .trim();

  if (
    submittedFlag ===
    "EDERA{THE_KERNEL_WAS_THE_BOUNDARY}"
  ) {
    state.flagSubmitted = true;
    state.phase = "complete";

    return [
      "FLAG VALID.",
      "",
      "ACCESS GRANTED.",
      "",
      "Investigation complete.",
      "",
      "You demonstrated the critical distinction:",
      "",
      "A container can isolate processes.",
      "It does not create a separate kernel.",
      "",
      "When the shared kernel is compromised,",
      "the isolation boundary can collapse.",
      "",
      "The kernel was the boundary.",
    ].join("\n");
  }

  return [
    "FLAG REJECTED.",
    "",
    "The submitted finding is incorrect.",
    "",
    "Continue investigating the boundary.",
  ].join("\n");
}


// ---------------------------------------------------------------------------
// Main command dispatcher
// ---------------------------------------------------------------------------

async function runCommand(command: string): Promise<string> {
  state.commandCount++;

  await new Promise((resolve) =>
    setTimeout(resolve, 180),
  );

  const normalized = command.trim();
  const lower = normalized.toLowerCase();

  if (!normalized) {
    return "";
  }

  if (lower === "help") {
    return commandHelp();
  }

  if (lower === "pwd") {
    return commandPwd();
  }

  if (lower === "whoami") {
    return commandWhoami();
  }

  if (lower === "id") {
    return commandId();
  }

  if (lower === "hostname") {
    return commandHostname();
  }

  if (
    lower === "uname" ||
    lower === "uname -a"
  ) {
    return commandUname();
  }

  if (lower === "env" || lower === "printenv") {
    return commandEnv();
  }

  if (
    lower === "ps" ||
    lower === "ps aux"
  ) {
    return commandPs();
  }

  if (lower === "ls" || lower.startsWith("ls ")) {
    return commandLs(commandArguments(normalized));
  }

  if (
    lower === "tree" ||
    lower.startsWith("tree ")
  ) {
    return commandTree(commandArguments(normalized));
  }

  if (
    lower === "cd" ||
    lower.startsWith("cd ")
  ) {
    return commandCd(commandArguments(normalized));
  }

  if (
    lower === "cat" ||
    lower.startsWith("cat ")
  ) {
    return commandCat(commandArguments(normalized));
  }

  if (
    lower === "head" ||
    lower.startsWith("head ")
  ) {
    return commandHead(commandArguments(normalized));
  }

  if (
    lower === "tail" ||
    lower.startsWith("tail ")
  ) {
    return commandTail(commandArguments(normalized));
  }

  if (
    lower === "file" ||
    lower.startsWith("file ")
  ) {
    return commandFile(commandArguments(normalized));
  }

  if (
    lower === "stat" ||
    lower.startsWith("stat ")
  ) {
    return commandStat(commandArguments(normalized));
  }

  if (
    lower === "find" ||
    lower.startsWith("find ")
  ) {
    return commandFind(commandArguments(normalized));
  }

  if (
    lower === "grep" ||
    lower.startsWith("grep ")
  ) {
    return commandGrep(commandArguments(normalized));
  }

  if (lower === "inspect workload") {
    return inspectWorkload();
  }

  if (lower === "inspect node") {
    return inspectNode();
  }

  if (lower === "scan kernel") {
    return scanKernel();
  }

  if (lower === "exploit kernel") {
    return exploitKernel();
  }

  if (lower === "list tenants") {
    return listTenants();
  }

  if (lower === "access customer-b") {
    return accessCustomerB();
  }

  if (lower === "access platform") {
    return accessPlatform();
  }

  if (lower === "inspect isolation") {
    return inspectIsolation();
  }

  if (
    lower === "connect isolated-zone-01" ||
    lower === "connect isolated"
  ) {
    return connectIsolated();
  }

  if (lower === "verify isolation") {
    return verifyIsolation();
  }

  if (lower === "exploit isolated") {
    return exploitIsolated();
  }

  if (lower === "access isolated-neighbor") {
    return accessIsolatedNeighbor();
  }

  if (
    lower === "kubectl get pods" ||
    lower === "kubectl get pod"
  ) {
    return kubectlGetPods();
  }

  if (
    lower === "kubectl get namespaces" ||
    lower === "kubectl get ns"
  ) {
    return kubectlGetNamespaces();
  }

  if (lower.startsWith("kubectl describe pod ")) {
    const name = normalized
      .slice("kubectl describe pod ".length)
      .trim();

    return kubectlDescribePod(name);
  }

  // ./script.sh
  if (
    lower.startsWith("./") ||
    lower.startsWith("/home/") ||
    lower.startsWith("/opt/")
  ) {
    const tokens = tokenize(normalized);
    const scriptPath = normalizePath(tokens[0]);

    return executeScript(scriptPath);
  }

  // sh script.sh / bash script.sh
  if (
    lower.startsWith("sh ") ||
    lower.startsWith("bash ")
  ) {
    const tokens = commandArguments(normalized);

    if (!tokens[0]) {
      return `${commandName(normalized)}: missing script operand`;
    }

    return executeScript(normalizePath(tokens[0]));
  }

  if (lower.startsWith("submit ")) {
    return submitFlag(normalized);
  }

  return [
    `bash: ${normalized}: command not found`,
    "",
    "Type 'help' to see available commands.",
  ].join("\n");
}


// ---------------------------------------------------------------------------
// Game state detection
// ---------------------------------------------------------------------------

function inspectOutput(
  command: string,
  output: string,
): void {
  const text =
    `${command}\n${output}`.toLowerCase();

  if (
    text.includes("arbitrary customer processing code") ||
    text.includes("customer-supplied") ||
    text.includes("customer supplied") ||
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
    text.includes("security boundary") ||
    text.includes("kernel=shared")
  ) {
    state.discoveredSharedKernel = true;
  }

  if (
    text.includes("acme-kernel-001") ||
    text.includes("cve-like finding") ||
    text.includes("kernel security scan")
  ) {
    state.kernelScanned = true;
  }

  if (
    command.toLowerCase() === "exploit kernel" &&
    text.includes("kernel compromised")
  ) {
    state.kernelCompromised = true;
    state.phase = "blast-radius";
  }

  if (
    command.toLowerCase() === "access customer-b" &&
    text.includes("customer-b access confirmed")
  ) {
    state.customerBAccessed = true;
  }

  if (
    command.toLowerCase() === "access platform" &&
    text.includes("platform access confirmed")
  ) {
    state.platformAccessed = true;
  }

  if (
    text.includes("isolated workload") ||
    text.includes("isolated execution zone") ||
    text.includes("isolated-zone-01")
  ) {
    state.isolatedDiscovered = true;
  }

  if (
    command.toLowerCase() === "exploit isolated" ||
    command.toLowerCase() === "access isolated-neighbor"
  ) {
    state.isolatedTested = true;
  }

  if (
    command.toLowerCase().startsWith("submit ") &&
    text.includes("access granted")
  ) {
    state.flagSubmitted = true;
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

  if (
    state.discoveredNode ||
    state.discoveredCodeExecution
  ) {
    state.phase = "investigation";
    return;
  }

  state.phase = "briefing";
}


// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function render(autoScrollTerminal = false): void {
  app.innerHTML = `
    <div class="game">

      ${renderTopBar()}

      <main class="main">

        <section class="mission">
          ${renderMission()}
        </section>

        <section class="workspace">

          <aside class="sidebar">

            <div class="card case-card">
              ${renderCasePanel()}
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

          <section class="terminal-panel">
            ${renderTerminal()}
          </section>

        </section>

      </main>

      ${renderFooter()}

    </div>
  `;

  bindEvents();

  if (autoScrollTerminal) {
    requestAnimationFrame(() => {
      const output =
        document.querySelector<HTMLDivElement>(
          "#terminal-output",
        );

      if (output) {
        output.scrollTop = output.scrollHeight;
      }
    });
  }
}


// ---------------------------------------------------------------------------
// Top bar
// ---------------------------------------------------------------------------

function renderTopBar(): string {
  return `
    <header class="topbar">

      <div class="brand">

        <div class="edera-mark">
          <span class="mark-ring"></span>
          <span class="mark-core"></span>
        </div>

        <div>
          <div class="brand-name">EDERA</div>
          <div class="brand-subtitle">
            ISOLATION LAB
          </div>
        </div>

      </div>

      <div class="challenge-title">
        <span class="eyebrow">SECURITY CHALLENGE 01</span>
        <strong>THE BOUNDARY</strong>
      </div>

      <div class="status">
        <span class="status-dot"></span>
        SIMULATION ONLINE
      </div>

    </header>
  `;
}


// ---------------------------------------------------------------------------
// Mission
// ---------------------------------------------------------------------------

function renderMission(): string {
  if (state.flagSubmitted) {
    return `
      <div class="mission-complete">

        <div class="complete-icon">✓</div>

        <div>
          <div class="eyebrow">
            INVESTIGATION COMPLETE
          </div>

          <h1>The kernel was the boundary.</h1>

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
        <div class="eyebrow">MISSION / ${state.phase.toUpperCase()}</div>

        <h1>Find the real security boundary.</h1>
      </div>

      <div class="mission-meta">
        <span>LAB</span>
        <strong>EDERA-SEC-001</strong>
      </div>

    </div>

    <div class="mission-copy">

      <p>
        A customer workload is executing arbitrary processing code
        inside a Kubernetes-style container environment.
      </p>

      <p>
        The workload has been compromised. Determine whether the
        compromise can cross the boundary and affect another tenant.
      </p>

      <div class="mission-warning">
        <span class="warning-icon">!</span>

        <span>
          This is a simulated Linux environment. Explore it like
          a real workload — the filesystem contains clues.
        </span>
      </div>

    </div>
  `;
}


// ---------------------------------------------------------------------------
// Case panel
// ---------------------------------------------------------------------------

function renderCasePanel(): string {
  return `
    <div class="case-panel">

      <div class="case-label">EDERA / ISOLATION LAB</div>

      <div class="case-title">
        THE<br>
        BOUNDARY
      </div>

      <div class="case-rule"></div>

      <div class="case-detail">
        <span>CASE</span>
        <strong>EDERA-SEC-001</strong>
      </div>

      <div class="case-detail">
        <span>WORKLOAD</span>
        <strong>
          ${
            state.environment === "isolated-zone"
              ? "customer-c / ai-agent"
              : "customer-a / image-processor"
          }
        </strong>
      </div>

      <div class="case-detail">
        <span>ENVIRONMENT</span>
        <strong>
          ${
            state.environment === "isolated-zone"
              ? "ISOLATED ZONE"
              : "CONTAINER"
          }
        </strong>
      </div>

      <div class="case-tip">
        <span class="tip-marker">▸</span>
        Explore the filesystem before following the obvious path.
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

        <div class="terminal-window-controls">
          <span></span>
          <span></span>
          <span></span>
        </div>

        <div class="terminal-title">
          <span class="terminal-title-main">terminal</span>
          <span class="terminal-title-context">
            ${
              state.environment === "isolated-zone"
                ? "isolated-zone-01"
                : "worker-02"
            }
          </span>
        </div>

        <div class="terminal-session">
          <span class="session-dot"></span>
          SHELL
        </div>

      </div>

      <div
        id="terminal-output"
        class="terminal-output"
        role="log"
        aria-live="polite"
      >
        ${renderHistory()}
      </div>

      <form
        id="terminal-form"
        class="terminal-input"
      >

        <span class="prompt">
          ${escapeHtml(promptText())}
        </span>

        <input
          id="command-input"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          aria-label="Terminal command"
        />

        <button
          type="submit"
          aria-label="Run command"
        >
          ↵
        </button>

      </form>

    </div>
  `;
}


// ---------------------------------------------------------------------------
// Architecture
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

  if (
    state.discoveredSharedKernel ||
    state.discoveredNode
  ) {
    return renderSharedKernelArchitecture();
  }

  return renderInitialArchitecture();
}

function renderInitialArchitecture(): string {
  return `
    <div class="architecture">

      <div class="arch-section-label">
        CURRENT WORKLOAD
      </div>

      <div class="arch-tenant-row">

        <div class="arch-workload active">
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
        <span class="arch-box-label">CONTAINER</span>
        <small>namespace / cgroup isolation</small>
      </div>

      <div class="arch-arrow">↓</div>

      <div class="arch-box unknown-box">
        <span class="question">?</span>
        <span>SECURITY BOUNDARY</span>
      </div>

      <div class="arch-hint">
        <span>TIP</span>
        Inspect <code>/etc</code> and discover the kernel.
      </div>

    </div>
  `;
}

function renderSharedKernelArchitecture(): string {
  return `
    <div class="architecture revealed">

      <div class="arch-section-label">
        SHARED EXECUTION NODE
      </div>

      <div class="arch-tenant-row">

        <div class="arch-workload active">
          <span class="arch-icon customer-icon">A</span>

          <div>
            <strong>customer-a</strong>
            <small>current</small>
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
        <small>process / namespace isolation</small>
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

      <div class="arch-section-label danger-label">
        NODE COMPROMISE
      </div>

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

        <div class="blast-title">
          BLAST RADIUS
        </div>

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
        SAME ATTACK / DIFFERENT BOUNDARY
      </div>

      <div class="comparison-row">

        <div class="comparison-side shared">

          <div class="comparison-label">
            SHARED KERNEL
          </div>

          <div class="mini-workload">
            A
          </div>

          <div class="mini-arrow">↓</div>

          <div class="mini-kernel danger">
            KERNEL
          </div>

          <div class="mini-arrow">↓</div>

          <div class="mini-workload exposed">
            B
          </div>

          <div class="comparison-result danger-text">
            CROSS-TENANT IMPACT
          </div>

        </div>

        <div class="comparison-side isolated">

          <div class="comparison-label">
            ISOLATED ZONE
          </div>

          <div class="mini-workload">
            C
          </div>

          <div class="mini-arrow">↓</div>

          <div class="mini-kernel safe">
            ZONE KERNEL
          </div>

          <div class="mini-arrow">↓</div>

          <div class="hardware-boundary">
            HARDWARE
          </div>

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
          ISOLATED EXECUTION ZONE
        </div>

        <div class="safe-zone-workload">
          customer-c / ai-agent
        </div>

        <div class="arch-arrow">
          ↓
        </div>

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
          The workload can be compromised without sharing
          its kernel with unrelated tenant workloads.
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
      description:
        "Determine what the workload is allowed to execute.",
      complete: state.discoveredCodeExecution,
    },

    {
      id: "node",
      title: "Identify the execution boundary",
      description:
        "Find out which node and kernel the workload uses.",
      complete:
        state.discoveredNode &&
        state.discoveredSharedKernel,
    },

    {
      id: "kernel",
      title: "Investigate the kernel",
      description:
        "Determine whether the shared kernel is vulnerable.",
      complete: state.kernelScanned,
    },

    {
      id: "blast",
      title: "Measure the blast radius",
      description:
        "Determine whether another tenant can be reached.",
      complete:
        state.customerBAccessed ||
        state.platformAccessed,
    },

    {
      id: "isolation",
      title: "Test the alternative",
      description:
        "Compare the same compromise against an isolated zone.",
      complete: state.isolatedTested,
    },

    {
      id: "flag",
      title: "Complete the investigation",
      description:
        "Submit the final finding.",
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
                ${
                  index === getCurrentObjectiveIndex()
                    ? "current"
                    : ""
                }
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


// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

function renderFooter(): string {
  return `
    <footer class="footer">

      <div>
        <span class="footer-label">
          ENVIRONMENT
        </span>
        WEBERNETES
      </div>

      <div>
        <span class="footer-label">
          COMMANDS
        </span>
        ${state.commandCount}
      </div>

      <div>
        <span class="footer-label">
          CASE
        </span>
        EDERA-SEC-001
      </div>

      <div class="footer-right">
        <span class="footer-status-dot"></span>
        SIMULATION MODE
      </div>

    </footer>
  `;
}

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

      if (!command) {
        return;
      }

      input.value = "";

      addCommandHistory(command);

      addHistory(
        "Running...",
        "terminal-loading",
      );

      render(true);

      const result = await runCommand(command);

      // Remove the loading entry.
      const loadingIndex =
        terminalHistory.findLastIndex(
          (entry) =>
            entry.className ===
            "terminal-loading",
        );

      if (loadingIndex !== -1) {
        terminalHistory.splice(
          loadingIndex,
          1,
        );
      }

      inspectOutput(command, result);

      if (result) {
        addHistory(
          result,
          "terminal-response",
        );
      }

      render(true);

      requestAnimationFrame(() => {
        document
          .querySelector<HTMLInputElement>(
            "#command-input",
          )
          ?.focus();
      });
    },
  );

  input.focus();
}

document.addEventListener("keydown", (event) => {
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
});

render();
