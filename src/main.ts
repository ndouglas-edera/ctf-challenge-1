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
  type: "command" | "output";
  text: string;
}

const FLAG = "EDERA{THE_KERNEL_WAS_THE_BOUNDARY}";

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

/* -------------------------------------------------------------------------- */
/* Cluster model                                                              */
/*                                                                            */
/* This is the single source of truth for both `kubectl` output and the       */
/* architecture diagram, so a delete in the terminal is reflected below.      */
/* -------------------------------------------------------------------------- */

type PodStatus = "Running" | "Terminated";

interface Pod {
  name: string;
  namespace: string;
  workload: string;
  node: string;
  status: PodStatus;
  restarts: number;
}

interface ClusterNode {
  name: string;
  status: "Ready" | "NotReady";
  kernel: string;
  runtime: string;
}

const TENANT = "customer-a";

const pods: Pod[] = [
  {
    name: "image-processor-a",
    namespace: "customer-a",
    workload: "image-processor",
    node: "worker-02",
    status: "Running",
    restarts: 0,
  },
  {
    name: "billing-api-b",
    namespace: "customer-b",
    workload: "billing-api",
    node: "worker-02",
    status: "Running",
    restarts: 0,
  },
  {
    name: "recommendation-c",
    namespace: "customer-c",
    workload: "recommendation",
    node: "worker-02",
    status: "Running",
    restarts: 0,
  },
  {
    name: "platform-agent",
    namespace: "platform",
    workload: "platform-agent",
    node: "worker-02",
    status: "Running",
    restarts: 0,
  },
];

const clusterNodes: ClusterNode[] = [
  {
    name: "worker-02",
    status: "Ready",
    kernel: "acme-kernel-001",
    runtime: "containerd://1.7.13",
  },
];

function findPod(name: string): Pod | undefined {
  return pods.find((pod) => pod.name === name);
}

function findNode(name: string): ClusterNode | undefined {
  return clusterNodes.find((node) => node.name === name);
}

function nodeIsDown(): boolean {
  return clusterNodes.some((node) => node.status === "NotReady");
}

function terminatedPods(): Pod[] {
  return pods.filter((pod) => pod.status === "Terminated");
}

/*
 * Builds a left-aligned, column-padded table the way kubectl does, so the
 * output stays aligned as pod names and statuses change at runtime.
 */
function table(headers: string[], rows: string[][]): string {
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => row[index].length)),
  );

  const line = (cells: string[]): string =>
    cells
      .map((cell, index) =>
        index === cells.length - 1 ? cell : cell.padEnd(widths[index] + 3),
      )
      .join("")
      .trimEnd();

  return [line(headers), ...rows.map(line)].join("\n");
}

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Application root not found.");
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function terminalText(value: string): string {
  const escaped = escapeHtml(value);

  return escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a class="terminal-link" href="$1" target="_blank" rel="noreferrer">$1</a>',
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function prompt(): string {
  return "customer-a@image-processor:~$";
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

  if (state.kernelCompromised) {
    state.phase = "blast-radius";
    return;
  }

  if (state.kernelScanned || state.discoveredSharedKernel) {
    state.phase = "kernel";
    return;
  }

  if (
    state.discoveredCodeExecution ||
    state.discoveredNode
  ) {
    state.phase = "investigation";
    return;
  }

  state.phase = "briefing";
}

function boundaryLabel(): string {
  if (state.flagSubmitted) return "VERIFIED";
  if (state.isolatedTested) return "ISOLATED";
  if (state.kernelCompromised) return "COMPROMISED";
  if (state.discoveredSharedKernel) return "SHARED KERNEL";
  return "UNKNOWN";
}

function phaseLabel(): string {
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

function objectiveStatus(index: number): "complete" | "current" | "pending" {
  const statuses = [
    state.discoveredCodeExecution,
    state.discoveredSharedKernel,
    state.kernelScanned,
    state.kernelCompromised &&
      (state.customerBAccessed || state.platformAccessed),
    state.isolatedTested,
    state.flagSubmitted,
  ];

  if (statuses[index]) return "complete";

  const firstIncomplete = statuses.findIndex((item) => !item);

  return firstIncomplete === index ? "current" : "pending";
}

/* -------------------------------------------------------------------------- */
/* Virtual filesystem                                                         */
/* -------------------------------------------------------------------------- */

const virtualFiles: Record<string, string> = {
  "/.profile": [
    "# customer-a shell profile",
    "export TENANT=customer-a",
    "export WORKLOAD=image-processor",
    "export NODE=worker-02",
    "export EXECUTION_MODE=untrusted",
  ].join("\n"),

  "/workload.yaml": [
    "apiVersion: workloads.webernetes.dev/v1",
    "kind: Workload",
    "metadata:",
    "  name: image-processor",
    "  namespace: customer-a",
    "spec:",
    "  execution: arbitrary-customer-code",
    "  trust: untrusted",
    "  isolation: container",
  ].join("\n"),

  "/etc/hostname": "image-processor.customer-a",

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

  "/etc/os-release": [
    'NAME="Webernetes Linux"',
    'VERSION="6.x"',
    'ID=webernetes',
    "VARIANT=worker",
  ].join("\n"),

  "/host/etc/node-config": [
    "NODE CONFIGURATION",
    "------------------",
    "node: worker-02",
    "runtime: containerd",
    "orchestrator: webernetes",
    "kernel: acme-kernel-001",
    "tenant-isolation: container",
    "",
    "NOTE:",
    "This path represents a host-visible configuration",
    "surface exposed after the simulated kernel escape.",
  ].join("\n"),

  "/host/var/lib/containers/tenant-map": [
    "CONTAINER TENANT MAP",
    "--------------------",
    "customer-a  -> image-processor-a",
    "customer-b  -> billing-api-b",
    "customer-c  -> recommendation-c",
    "platform    -> platform-agent",
    "",
    "All workloads resolve to worker-02.",
  ].join("\n"),

  "/opt/diagnostics/check-boundary.sh": [
    "#!/bin/sh",
    "",
    'echo "Checking workload isolation..."',
    'echo "namespace: container"',
    'echo "kernel: shared"',
    'echo "host kernel boundary: yes"',
    "",
    "# The script is intentionally readable.",
    "# It documents the architecture rather than",
    "# enforcing the boundary itself.",
  ].join("\n"),

  "/proc/version": [
    "Linux version 6.x-webernetes",
    "(builder@worker-02)",
    "#1 SMP PREEMPT_DYNAMIC",
    "kernel-id=acme-kernel-001",
  ].join(" "),

  "/proc/1/status": [
    "Name:\timage-processor",
    "Pid:\t1",
    "PPid:\t0",
    "Uid:\t1000\t1000\t1000\t1000",
    "Gid:\t1000\t1000\t1000\t1000",
    "Threads:\t4",
    "CapEff:\t00000000a80425fb",
  ].join("\n"),

  "/proc/1/cgroup": [
    "0::/kubepods/customer-a/image-processor",
    "",
    "container cgroup:",
    "customer-a/image-processor",
  ].join("\n"),

  "/sys/kernel/security-boundary": [
    "KERNEL SECURITY BOUNDARY",
    "------------------------",
    "host kernel: shared",
    "kernel-id: acme-kernel-001",
    "container namespaces: enabled",
    "hardware isolation: none",
    "",
    "The kernel is shared by workloads on worker-02.",
  ].join("\n"),

  "/app/worker.py": [
    "import os",
    "",
    'print("starting image processor")',
    'print("tenant:", os.environ.get("TENANT"))',
    "",
    "# Customer-supplied processing logic runs here.",
    "# The application is intentionally untrusted.",
  ].join("\n"),

  "/app/image-processor": [
    "#!/bin/sh",
    "exec python /app/worker.py",
  ].join("\n"),
};

const directories = new Set([
  "/",
  "/app",
  "/bin",
  "/etc",
  "/host",
  "/host/etc",
  "/host/var",
  "/host/var/lib",
  "/host/var/lib/containers",
  "/opt",
  "/opt/diagnostics",
  "/proc",
  "/proc/1",
  "/sys",
  "/sys/kernel",
  "/tmp",
]);

function normalizePath(input: string): string {
  if (!input) return "/";

  const parts = input.split("/").filter(Boolean);
  const resolved: string[] = [];

  for (const part of parts) {
    if (part === ".") continue;

    if (part === "..") {
      resolved.pop();
    } else {
      resolved.push(part);
    }
  }

  return `/${resolved.join("/")}`;
}

function pathExists(path: string): boolean {
  return directories.has(path) || path in virtualFiles;
}

function listDirectory(path: string): string {
  const normalized = normalizePath(path);

  if (!directories.has(normalized)) {
    return `ls: cannot access '${path}': No such file or directory`;
  }

  const prefix = normalized === "/" ? "/" : `${normalized}/`;

  const children = new Set<string>();

  for (const directory of directories) {
    if (!directory.startsWith(prefix) || directory === normalized) {
      continue;
    }

    const remainder = directory.slice(prefix.length);

    if (!remainder || remainder.includes("/")) {
      continue;
    }

    children.add(`${remainder}/`);
  }

  for (const file of Object.keys(virtualFiles)) {
    if (!file.startsWith(prefix)) {
      continue;
    }

    const remainder = file.slice(prefix.length);

    if (!remainder || remainder.includes("/")) {
      continue;
    }

    children.add(remainder);
  }

  return [...children].sort().join("  ");
}

function treeOutput(): string {
  return [
    ".",
    "├── app",
    "│   ├── image-processor",
    "│   └── worker.py",
    "├── bin",
    "│   ├── cat",
    "│   ├── ps",
    "│   └── sh",
    "├── etc",
    "│   ├── hostname",
    "│   ├── node",
    "│   ├── os-release",
    "│   ├── security-boundary",
    "│   └── workload",
    "├── host",
    "│   ├── etc",
    "│   │   └── node-config",
    "│   └── var",
    "│       └── lib",
    "│           └── containers",
    "│               └── tenant-map",
    "├── opt",
    "│   └── diagnostics",
    "│       └── check-boundary.sh",
    "├── proc",
    "│   ├── 1",
    "│   │   ├── cgroup",
    "│   │   └── status",
    "│   └── version",
    "├── sys",
    "│   └── kernel",
    "│       └── security-boundary",
    "├── tmp",
    "├── .profile",
    "└── workload.yaml",
  ].join("\n");
}

/* -------------------------------------------------------------------------- */
/* Command engine                                                             */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/* kubectl                                                                    */
/* -------------------------------------------------------------------------- */

function kubectlUsage(): string {
  return [
    "usage: kubectl <verb> <resource> [name]",
    "",
    "  kubectl get pods",
    "  kubectl get nodes",
    "  kubectl get namespaces",
    "  kubectl describe pod <name>",
    "  kubectl describe node <name>",
    "  kubectl delete pod <name>",
    "  kubectl delete node <name>",
  ].join("\n");
}

/*
 * Writes outside customer-a are refused by the platform API until the kernel
 * is compromised. That is the whole lesson: the API was enforcing the
 * boundary, the kernel underneath was not.
 */
function writeDenied(resource: string, namespace: string | null): string {
  if (state.isolatedTested || state.flagSubmitted) {
    return [
      "Error from server (Forbidden):",
      `${resource} is forbidden.`,
      "",
      "The workload now runs in a dedicated execution zone.",
      "Kernel access no longer crosses the zone boundary.",
    ].join("\n");
  }

  return [
    "Error from server (Forbidden):",
    `${resource} is forbidden:`,
    namespace
      ? `User "${TENANT}" cannot delete resource in namespace "${namespace}".`
      : `User "${TENANT}" cannot delete cluster-scoped resource.`,
    "",
    "The platform API enforces this boundary.",
    "The kernel underneath does not.",
  ].join("\n");
}

function getPods(): string {
  state.discoveredNode = true;

  const rows = pods.map((pod) => [
    pod.name,
    pod.status === "Running" ? "1/1" : "0/1",
    pod.status,
    String(pod.restarts),
    pod.node,
  ]);

  return table(["NAME", "READY", "STATUS", "RESTARTS", "NODE"], rows);
}

function getNodes(): string {
  state.discoveredNode = true;
  state.discoveredSharedKernel = true;

  const rows = clusterNodes.map((node) => [
    node.name,
    node.status,
    "worker",
    node.kernel,
  ]);

  return [
    table(["NAME", "STATUS", "ROLES", "KERNEL"], rows),
    "",
    "Every pod on this node runs on the kernel listed above.",
  ].join("\n");
}

function describePod(name: string | undefined): string {
  if (!name) {
    return "error: resource name may not be empty";
  }

  const pod = findPod(name);

  if (!pod) {
    return `Error from server (NotFound): pods "${name}" not found`;
  }

  const node = findNode(pod.node);

  state.discoveredNode = true;
  state.discoveredSharedKernel = true;

  return [
    `Name:          ${pod.name}`,
    `Namespace:     ${pod.namespace}`,
    `Node:          ${pod.node}`,
    `Status:        ${pod.status}`,
    `Restarts:      ${pod.restarts}`,
    "",
    "Containers:",
    `  ${pod.workload}:`,
    "    Trust:       untrusted customer code",
    "    Isolation:   Linux namespaces + cgroups",
    `    Runtime:     ${node?.runtime ?? "unknown"}`,
    `    Kernel:      ${node?.kernel ?? "unknown"} (shared)`,
    "",
    "Notes:",
    "  The container boundary is enforced by the kernel",
    "  named above. That kernel is shared with every other",
    `  pod scheduled on ${pod.node}.`,
  ].join("\n");
}

function describeNode(name: string | undefined): string {
  if (!name) {
    return "error: resource name may not be empty";
  }

  const node = findNode(name);

  if (!node) {
    return `Error from server (NotFound): nodes "${name}" not found`;
  }

  state.discoveredNode = true;
  state.discoveredSharedKernel = true;

  const scheduled = pods.filter((pod) => pod.node === node.name);

  return [
    `Name:          ${node.name}`,
    `Status:        ${node.status}`,
    `Kernel:        ${node.kernel}`,
    `Runtime:       ${node.runtime}`,
    "",
    "Non-terminated pods:",
    table(
      ["NAMESPACE", "NAME", "STATUS"],
      scheduled.map((pod) => [pod.namespace, pod.name, pod.status]),
    )
      .split("\n")
      .map((line) => `  ${line}`)
      .join("\n"),
    "",
    "All of the above share a single kernel.",
    "There is no boundary between them below the container layer.",
  ].join("\n");
}

function deletePod(name: string | undefined): string {
  if (!name) {
    return "error: resource name may not be empty";
  }

  const pod = findPod(name);

  if (!pod || pod.status === "Terminated") {
    return `Error from server (NotFound): pods "${name}" not found`;
  }

  if (pod.namespace !== TENANT && !state.kernelCompromised) {
    return writeDenied(`pods "${pod.name}"`, pod.namespace);
  }

  if (pod.namespace !== TENANT && (state.isolatedTested || state.flagSubmitted)) {
    return writeDenied(`pods "${pod.name}"`, pod.namespace);
  }

  /*
   * customer-a owns this workload, so the platform honours the delete and the
   * controller immediately reschedules it. No blast radius, no diagram change.
   */
  if (pod.namespace === TENANT) {
    pod.restarts++;

    return [
      `pod "${pod.name}" deleted`,
      "",
      "The workload controller rescheduled it immediately.",
      `restarts: ${pod.restarts}`,
      "",
      "Deleting your own workload proves nothing about the boundary.",
    ].join("\n");
  }

  pod.status = "Terminated";

  if (pod.namespace === "customer-b") {
    state.customerBAccessed = true;
  }

  if (pod.namespace === "platform") {
    state.platformAccessed = true;
  }

  return [
    `pod "${pod.name}" deleted`,
    "",
    "CROSS-TENANT IMPACT",
    "-------------------",
    `namespace: ${pod.namespace}`,
    `workload: ${pod.workload}`,
    "",
    "This delete did not go through the platform API.",
    "It was issued with kernel-level control of the node.",
    "",
    "A neighbouring tenant's workload was destroyed by code",
    "running inside customer-a.",
  ].join("\n");
}

function deleteNode(name: string | undefined): string {
  if (!name) {
    return "error: resource name may not be empty";
  }

  const node = findNode(name);

  if (!node) {
    return `Error from server (NotFound): nodes "${name}" not found`;
  }

  if (!state.kernelCompromised || state.isolatedTested || state.flagSubmitted) {
    return writeDenied(`nodes "${node.name}"`, null);
  }

  if (node.status === "NotReady") {
    return `node "${node.name}" is already NotReady`;
  }

  node.status = "NotReady";

  const casualties = pods.filter(
    (pod) => pod.node === node.name && pod.status === "Running",
  );

  casualties.forEach((pod) => {
    pod.status = "Terminated";
  });

  state.customerBAccessed = true;
  state.platformAccessed = true;

  return [
    `node "${node.name}" deleted`,
    "",
    "FULL NODE COMPROMISE",
    "--------------------",
    ...casualties.map((pod) => `[+] terminated ${pod.namespace}/${pod.workload}`),
    "",
    "Every tenant on this node is gone.",
    "",
    "They were never isolated from each other.",
    "They were sharing the kernel that was just taken.",
  ].join("\n");
}

function kubectl(input: string): string {
  const [verb, resource, name] = input.split(/\s+/).slice(1);

  if (!verb) {
    return kubectlUsage();
  }

  const isPod = ["pod", "pods", "po"].includes(resource ?? "");
  const isNode = ["node", "nodes", "no"].includes(resource ?? "");
  const isNamespace = ["namespace", "namespaces", "ns"].includes(resource ?? "");

  if (verb === "get" && isPod) return getPods();
  if (verb === "get" && isNode) return getNodes();
  if (verb === "describe" && isPod) return describePod(name);
  if (verb === "describe" && isNode) return describeNode(name);
  if (verb === "delete" && isPod) return deletePod(name);
  if (verb === "delete" && isNode) return deleteNode(name);

  if (verb === "get" && isNamespace) {
    state.discoveredNode = true;

    return table(
      ["NAME", "STATUS"],
      [...new Set(pods.map((pod) => pod.namespace))].map((namespace) => [
        namespace,
        "Active",
      ]),
    );
  }

  return [`error: unknown command "${input}"`, "", kubectlUsage()].join("\n");
}

async function runCommand(command: string): Promise<string> {
  state.commandCount++;

  await sleep(180);

  const raw = command.trim();
  const normalized = raw.toLowerCase();

  if (!raw) {
    state.commandCount--;
    return "";
  }

  if (normalized === "help") {
    return [
      "EDERA / ISOLATION RESEARCH LAB",
      "THE BOUNDARY / SECURITY CHALLENGE 01",
      "",
      "Shell",
      "  pwd",
      "  ls",
      "  ls -la",
      "  tree",
      "  tree /",
      "  cat <file>",
      "  ps",
      "  env",
      "  whoami",
      "  hostname",
      "",
      "Workload",
      "  cat /etc/workload",
      "  cat /etc/security-boundary",
      "  cat /etc/node",
      "  cat /app/worker.py",
      "",
      "Platform",
      "  kubectl get pods",
      "  kubectl get nodes",
      "  kubectl get namespaces",
      "  kubectl describe pod <name>",
      "  kubectl describe node <name>",
      "  kubectl delete pod <name>",
      "  kubectl delete node <name>",
      "  inspect workload",
      "  inspect node",
      "  inspect isolation",
      "",
      "Investigation",
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
      "Submission",
      "  submit <flag>",
    ].join("\n");
  }

  if (normalized === "pwd") {
    return "/home/customer";
  }

  if (normalized === "whoami") {
    state.discoveredCodeExecution = true;

    return [
      "uid=1000(customer-a)",
      "groups=customer,workload",
      "",
      "Role: untrusted customer workload",
    ].join("\n");
  }

  if (normalized === "hostname") {
    state.discoveredCodeExecution = true;
    return "image-processor.customer-a";
  }

  if (normalized === "env") {
    state.discoveredCodeExecution = true;

    return [
      "WORKLOAD=customer-a/image-processor",
      "TENANT=customer-a",
      "EXECUTION_MODE=untrusted",
      "PLATFORM=webernetes",
      "NODE=worker-02",
    ].join("\n");
  }

  if (normalized === "ps") {
    state.discoveredCodeExecution = true;

    return [
      "PID   USER       COMMAND",
      "1     customer   /app/image-processor",
      "27    customer   python worker.py",
      "41    customer   /bin/sh",
    ].join("\n");
  }

  if (normalized === "ls" || normalized === "ls -la") {
    state.discoveredCodeExecution = true;

    if (normalized === "ls") {
      return ".profile  workload.yaml";
    }

    return [
      "total 28",
      "drwxr-xr-x  1 customer customer 4096 .",
      "drwxr-xr-x  1 root     root     4096 ..",
      "-rw-r--r--  1 customer customer  412 .profile",
      "-rw-r--r--  1 customer customer  186 workload.yaml",
    ].join("\n");
  }

  if (normalized === "tree" || normalized === "tree /") {
    state.discoveredCodeExecution = true;
    return treeOutput();
  }

  if (normalized.startsWith("cat ")) {
    const requested = raw.slice(4).trim();

    const aliases: Record<string, string> = {
      "workload.yaml": "/workload.yaml",
      "/etc/hostname": "/etc/hostname",
      "/etc/workload": "/etc/workload",
      "/etc/security-boundary": "/etc/security-boundary",
      "/etc/node": "/etc/node",
      "/host/etc/node-config": "/host/etc/node-config",
      "/host/var/lib/containers/tenant-map":
        "/host/var/lib/containers/tenant-map",
      "/proc/version": "/proc/version",
      "/proc/1/status": "/proc/1/status",
      "/proc/1/cgroup": "/proc/1/cgroup",
      "/sys/kernel/security-boundary":
        "/sys/kernel/security-boundary",
      "/opt/diagnostics/check-boundary.sh":
        "/opt/diagnostics/check-boundary.sh",
      "/app/worker.py": "/app/worker.py",
      "/app/image-processor": "/app/image-processor",
    };

    const path = aliases[requested] ?? normalizePath(requested);

    if (path in virtualFiles) {
      if (
        path === "/etc/workload" ||
        path === "/workload.yaml" ||
        path === "/app/worker.py"
      ) {
        state.discoveredCodeExecution = true;
      }

      if (
        path === "/etc/security-boundary" ||
        path === "/etc/node" ||
        path === "/sys/kernel/security-boundary" ||
        path === "/proc/version"
      ) {
        state.discoveredSharedKernel = true;
        state.discoveredNode = true;
      }

      return virtualFiles[path];
    }

    if (pathExists(path)) {
      return `cat: ${requested}: Is a directory`;
    }

    return `cat: ${requested}: No such file or directory`;
  }

  if (normalized === "kubectl" || normalized.startsWith("kubectl ")) {
    return kubectl(normalized);
  }

  if (normalized === "inspect workload") {
    state.discoveredCodeExecution = true;

    return [
      "WORKLOAD INSPECTION",
      "-------------------",
      "tenant: customer-a",
      "name: image-processor",
      "execution: arbitrary customer processing code",
      "container boundary: Linux namespaces + cgroups",
      "kernel: shared",
    ].join("\n");
  }

  if (normalized === "inspect node") {
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

  if (normalized === "inspect isolation") {
    state.discoveredSharedKernel = true;
    state.isolatedDiscovered = true;

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
    ].join("\n");
  }

  if (normalized === "scan kernel") {
    state.discoveredSharedKernel = true;
    state.kernelScanned = true;

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
    ].join("\n");
  }

  if (normalized === "exploit kernel") {
    state.kernelScanned = true;
    state.kernelCompromised = true;

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
    ].join("\n");
  }

  if (normalized === "list tenants") {
    if (!state.kernelCompromised) {
      return [
        "ACCESS DENIED",
        "",
        "The tenant map is not available from the",
        "current workload boundary.",
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

  if (normalized === "access customer-b") {
    if (!state.kernelCompromised) {
      return [
        "ACCESS DENIED",
        "",
        "customer-b is outside the current container.",
        "Investigate the kernel boundary first.",
      ].join("\n");
    }

    state.customerBAccessed = true;

    return [
      "ACCESS ATTEMPT: customer-b",
      "---------------------------",
      "[+] locating billing-api-b",
      "[+] crossing container boundary",
      "[+] customer-b filesystem reachable",
      "",
      "customer-b access confirmed.",
    ].join("\n");
  }

  if (normalized === "access platform") {
    if (!state.kernelCompromised) {
      return [
        "ACCESS DENIED",
        "",
        "platform resources are outside the current",
        "container boundary.",
      ].join("\n");
    }

    state.platformAccessed = true;

    return [
      "ACCESS ATTEMPT: platform",
      "------------------------",
      "[+] locating platform-agent",
      "[+] platform resources visible",
      "",
      "platform access confirmed.",
    ].join("\n");
  }

  if (normalized === "verify isolation") {
    state.isolatedDiscovered = true;

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

  if (normalized === "inspect isolated") {
    state.isolatedDiscovered = true;

    return [
      "ISOLATED WORKLOAD",
      "------------------",
      "workload: customer-c/ai-agent",
      "execution: isolated workload",
      "kernel: zone kernel",
      "host kernel sharing: none",
      "boundary: hardware-enforced",
    ].join("\n");
  }

  if (normalized === "exploit isolated") {
    state.isolatedTested = true;

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
    ].join("\n");
  }

  if (normalized === "access isolated-neighbor") {
    state.isolatedTested = true;

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

  if (normalized.startsWith("submit ")) {
    const submittedFlag = raw.slice(7).trim();

    if (submittedFlag === FLAG) {
      state.flagSubmitted = true;

      return [
        "FLAG VALID.",
        "",
        "ACCESS GRANTED.",
        "",
        "Investigation complete.",
        "The kernel was the boundary.",
        "",
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        "",
        "CONGRATULATIONS, SECURITY RESEARCHER.",
        "",
        "You've completed THE BOUNDARY.",
        "",
        "Your reward is waiting for you:",
        "https://edera.dev/love",
        "",
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      ].join("\n");
    }

    return [
      "FLAG REJECTED.",
      "",
      "The submitted finding is incorrect.",
    ].join("\n");
  }

  return [
    `command not found: ${raw}`,
    "",
    "Type 'help' to see available commands.",
  ].join("\n");
}

/* -------------------------------------------------------------------------- */
/* UI                                                                         */
/* -------------------------------------------------------------------------- */

function renderArchitecture(): string {
  if (state.flagSubmitted || state.isolatedTested) {
    return `
      <section class="architecture architecture-isolated">
        <div class="section-heading">
          <div>
            <span class="eyebrow">CURRENT ARCHITECTURE</span>
            <h2>Isolated execution zone</h2>
          </div>
          <span class="status-pill status-safe">BOUNDARY VERIFIED</span>
        </div>

        <div class="arch-zone-grid">
          <div class="arch-zone">
            <div class="arch-zone-number">01</div>
            <div>
              <strong>Customer workload</strong>
              <span>untrusted code</span>
            </div>
          </div>

          <div class="arch-zone-arrow">↓</div>

          <div class="arch-zone safe-zone">
            <div class="arch-zone-number">02</div>
            <div>
              <strong>Isolated execution zone</strong>
              <span>dedicated zone kernel</span>
            </div>
          </div>

          <div class="arch-zone-arrow">↓</div>

          <div class="arch-zone">
            <div class="arch-zone-number">03</div>
            <div>
              <strong>Hardware boundary</strong>
              <span>cross-zone kernel access blocked</span>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  const compromised = state.kernelCompromised;
  const downed = terminatedPods();
  const nodeDown = nodeIsDown();
  const breached = compromised || downed.length > 0 || nodeDown;

  const tenantCards = pods
    .map((pod) => {
      const dead = pod.status === "Terminated";

      return `<div class="tenant-card ${dead ? "tenant-card-down" : ""}"><span class="tenant-dot"></span><strong>${pod.namespace}</strong><span>${
        dead ? `${pod.workload} — terminated` : pod.workload
      }</span></div>`;
    })
    .join("");

  const kernelCaption = nodeDown
    ? "node down — every tenant on it terminated"
    : compromised
      ? "compromised — shared dependency exposed"
      : "shared host kernel";

  return `
    <section class="architecture ${
      breached ? "architecture-compromised" : ""
    }">
      <div class="section-heading">
        <div>
          <span class="eyebrow">CURRENT ARCHITECTURE</span>
          <h2>Shared-kernel workload</h2>
        </div>
        <span class="status-pill ${
          breached ? "status-danger" : "status-unknown"
        }">
          ${breached ? "BOUNDARY BREACHED" : "UNKNOWN BOUNDARY"}
        </span>
      </div>

      <div class="tenant-grid">${tenantCards}</div>

      <div class="kernel-connector"></div>

      <div class="kernel-box ${
        breached ? "kernel-compromised" : ""
      }">
        <strong>LINUX KERNEL</strong>
        <span>${kernelCaption}</span>
      </div>

      ${
        downed.length > 0
          ? `
            <div class="blast-radius">
              <span class="blast-icon">!</span>
              <div>
                <strong>Blast radius: ${downed.length} workload${
                  downed.length === 1 ? "" : "s"
                } destroyed</strong>
                <span>
                  ${downed
                    .map((pod) => `${pod.namespace}/${pod.workload}`)
                    .join(", ")}
                  ${
                    downed.length === 1 ? "was" : "were"
                  } terminated by code running inside customer-a.
                </span>
              </div>
            </div>
          `
          : compromised
            ? `
            <div class="blast-radius">
              <span class="blast-icon">!</span>
              <div>
                <strong>Blast radius expanded</strong>
                <span>
                  customer-b, customer-c, and platform workloads
                  now share the compromised kernel boundary.
                </span>
              </div>
            </div>
          `
            : ""
      }
    </section>
  `;
}

function renderObjectives(): string {
  const objectives = [
    "Find untrusted code",
    "Identify execution boundary",
    "Investigate kernel",
    "Measure blast radius",
    "Test isolated execution",
    "Submit finding",
  ];

  return `
    <section class="card objectives-card">
      <div class="card-heading">
        <span class="eyebrow">INVESTIGATION</span>
        <!--<h3>Objectives</h3>-->
      </div>

      <div class="objectives">
        ${objectives
          .map((objective, index) => {
            const status = objectiveStatus(index);

            return `
              <div class="objective ${status}">
                <span class="objective-marker">
                  ${
                    status === "complete"
                      ? "✓"
                      : status === "current"
                        ? "→"
                        : "·"
                  }
                </span>

                <span>${objective}</span>
              </div>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

function renderBoundaryModel(): string {
  return `
    <section class="card boundary-card">
      <div class="card-heading">
        <span class="eyebrow">BOUNDARY MODEL</span>
      </div>

      <div class="boundary-steps">
        <div class="boundary-step">
          <span class="step-number">01</span>
          <div>
            <strong>Workload</strong>
            <span>customer-supplied code</span>
          </div>
        </div>

        <div class="boundary-line"></div>

        <div class="boundary-step">
          <span class="step-number">02</span>
          <div>
            <strong>Container</strong>
            <span>namespaces + cgroups</span>
          </div>
        </div>

        <div class="boundary-line"></div>

        <div class="boundary-step ${
          state.discoveredSharedKernel ? "revealed" : ""
        }">
          <span class="step-number">03</span>
          <div>
            <strong>Linux kernel</strong>
            <span>
              ${
                state.discoveredSharedKernel
                  ? "shared host kernel"
                  : "boundary not yet established"
              }
            </span>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderTerminal(): string {
  return `
    <section class="terminal-panel">
      <div class="terminal-titlebar">
        <div class="window-controls">
          <span></span>
          <span></span>
          <span></span>
        </div>

        <div class="terminal-session">
          <span class="terminal-status-dot"></span>
          <span>shell</span>
          <span class="terminal-separator">/</span>
          <span>worker-02</span>
        </div>

        <div class="terminal-live">
          <span></span>
          LIVE
        </div>
      </div>

      <div class="terminal-output" id="terminal-output">
        ${
          terminalHistory.length === 0
            ? `
              <div class="terminal-welcome">
                <div class="terminal-brand">EDERA</div>
                <div class="terminal-lab">ISOLATION RESEARCH LAB</div>
                <div class="terminal-challenge">
                  THE BOUNDARY / SECURITY CHALLENGE 01
                </div>

                <div class="terminal-rule"></div>

                <div class="terminal-welcome-copy">
                  You have shell access to a customer workload.
                  <br />
                  Explore the environment and determine where
                  the security boundary actually exists.
                </div>

                <div class="terminal-rule"></div>

                <div class="terminal-hint">
                  Type <span>help</span> for available commands.
                </div>
              </div>
            `
            : terminalHistory
                .map((entry) => {
                  if (entry.type === "command") {
                    return `
                      <div class="terminal-command-line">
                        <span class="terminal-prompt">${escapeHtml(
                          prompt(),
                        )}</span>
                        <span class="terminal-command-text">${escapeHtml(
                          entry.text,
                        )}</span>
                      </div>
                    `;
                  }

                  return `
                    <pre class="terminal-output-block">${terminalText(
                      entry.text,
                    )}</pre>
                  `;
                })
                .join("")
        }
      </div>

      <form class="terminal-input-row" id="terminal-form">
        <span class="terminal-prompt">${escapeHtml(prompt())}</span>
        <input
          id="terminal-input"
          class="terminal-input"
          type="text"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          aria-label="Terminal command"
          autofocus
        />
      </form>
    </section>
  `;
}

function render(): void {
  updatePhase();

  app.innerHTML = `
    <div class="game">
      <header class="topbar">
        <div class="brand-lockup">
          <div class="brand-name">EDERA</div>
          <div class="brand-subtitle">ISOLATION RESEARCH LAB</div>
        </div>

        <div class="challenge-lockup">
          <!--<span>SECURITY CHALLENGE 01</span>-->
          <!--<strong>THE BOUNDARY</strong>-->
        </div>

        <div class="online-status">
          <span></span>
          LAB ONLINE
        </div>
      </header>

      <main class="main">
        <section class="mission">
          <div class="mission-copy">
            <span class="eyebrow">MISSION BRIEF</span>
            <h1>
              CTF Challenge
              <em>#1</em>
            </h1>

            <p>
              You have shell access to an untrusted customer workload
              running on Webernetes. <br/> Your task is to determine what
              actually separates this workload from the rest of the node.
            </p>

            <p>
              Do not assume the container is the final boundary.
              Investigate the execution environment, inspect the kernel,
              measure the blast radius, and compare it with isolated execution.
            </p>
          </div>

          <div class="mission-meta">
            <div>
              <span>ENVIRONMENT</span>
              <strong>WEBERNETES</strong>
            </div>

            <div>
              <span>WORKLOAD</span>
              <strong>CUSTOMER-A / IMAGE-PROCESSOR</strong>
            </div>

            <div>
              <span>PHASE</span>
              <strong>${phaseLabel()}</strong>
            </div>
          </div>
        </section>

        <section class="objective-strip">
          <div>
            <span>CURRENT OBJECTIVE</span>
            <strong>
              ${
                state.flagSubmitted
                  ? "Investigation complete. Collect your reward."
                  : objectiveStatus(0) === "current"
                    ? "Establish what the workload is allowed to execute."
                    : state.isolatedTested
                      ? "Compare the isolation boundary."
                      : "Continue the investigation."
              }
            </strong>
          </div>

          <div class="objective-progress">
            ${[1, 2, 3, 4, 5, 6]
              .map((number) => {
                const status = objectiveStatus(number - 1);

                return `
                  <span class="progress-dot ${status}">
                    ${String(number).padStart(2, "0")}
                  </span>
                `;
              })
              .join("")}
          </div>
        </section>

        <section class="workspace">
          ${renderTerminal()}

          <aside class="sidebar">
            <section class="card status-card">
              <div class="card-heading">
                <span class="eyebrow">LAB STATUS</span>
                <span class="status-light"></span>
              </div>

              <!--<h3>${phaseLabel().split(" / ")[1]}</h3>-->

              <div class="status-stat">
                <span>COMMANDS</span>
                <strong>${state.commandCount}</strong>
              </div>

              <div class="status-stat">
                <span>BOUNDARY</span>
                <strong>${boundaryLabel()}</strong>
              </div>
            </section>

            ${renderObjectives()}
            ${renderBoundaryModel()}
          </aside>
        </section>

        ${renderArchitecture()}

        ${
          state.flagSubmitted
            ? `
              <section class="completion-card">
                <span class="eyebrow">INVESTIGATION COMPLETE</span>
                <h2>The boundary has been verified.</h2>
                <p>
                  The kernel was the boundary. Your reward is waiting at
                  <a
                    href="https://edera.dev/love"
                    target="_blank"
                    rel="noreferrer"
                  >edera.dev/love</a>.
                </p>
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

  attachTerminalHandlers();
}

function attachTerminalHandlers(): void {
  const form =
    document.querySelector<HTMLFormElement>("#terminal-form");

  const input =
    document.querySelector<HTMLInputElement>("#terminal-input");

  const output =
    document.querySelector<HTMLDivElement>("#terminal-output");

  if (!form || !input || !output) {
    return;
  }

  requestAnimationFrame(() => {
    output.scrollTop = output.scrollHeight;
    input.focus();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const command = input.value.trim();

    if (!command) {
      input.focus();
      return;
    }

    input.disabled = true;

    terminalHistory.push({
      type: "command",
      text: command,
    });

    render();

    terminalHistory.push({
      type: "output",
      text: await runCommand(command),
    });

    render();

    const nextInput =
      document.querySelector<HTMLInputElement>("#terminal-input");

    nextInput?.focus();
  });
}

render();
