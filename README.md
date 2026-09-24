# CTF Challenge 1
This is our first ever CTF-style challenge to discover security shortfalls of a shared Linux kernel in Kubernetes

## Challenge Layout

```
┌─────────────────────────────────────────────────────────────┐
│ TOP BAR / BRANDING                                          │
├─────────────────────────────────────────────────────────────┤
│ MISSION                                                     │
├──────────────────────────────┬──────────────────────────────┤
│                              │                              │
│                              │       ARCHITECTURE           │
│         TERMINAL             │                              │
│                              ├──────────────────────────────┤
│   complete the challenges    │                              │
│                              │       INVESTIGATION          │
│                              │                              │
│                              │                              │
├──────────────────────────────┴──────────────────────────────┤
│ FOOTER LINKS                                                │
└─────────────────────────────────────────────────────────────┘
```

## Flag 1
Edera supports heterogeneous, mixed-workload clusters, but running mixed runtime classes on the same individual node is discouraged due to resource management trade-offs. Find the pod that has no assigned runtimeClassName.
```
kubectl describe pod -n customer-c   recommendation-c
```
Technically, an Edera-enabled node retains the default containerd runtime alongside the Edera runtime handler in its CRI configuration. However, running both isolated Edera pods and standard containers side-by-side on the exact same physical or virtual node leads to operational friction:
<br/><br/>
Edera partitions host resources between ```dom0``` (the host system context) and ```domU``` (the isolated zone execution context). By default, ```dom0``` receives a constrained fraction of node memory (~35%). Running standard workloads in ```dom0``` can trigger out-of-memory (OOM) evictions before ```kubelet``` detects node-level memory pressure.

## Flag 2
Insert description

## Answers

| Objective                     | Command that yields it                                     | Answer                                          |
| :---------------------------- | :--------------------------------------------------------: | ----------------------------------------------: |
| 1. Zone kernel image          | ```kubectl describe pod image-processor-a```               | ```submit ghcr.io/edera-dev/zone-kernel:6.15``` |
| 2. Cached digest              | ```protect image list --output table```                    | ```submit sha256:8c4f2a91d7e3b06547ac1fe920dd35b8746c0a29e1fb5d3c88ea47612d90bf5a```                   |
| 3. Kernel variant             | ```protect image list-kernel-variants```                   | ```submit ebpf```                               |
| 4. Failed zone                | ```protect zone list --selector status.state=failed```     | ```submit zone-analytics-d```                   |
| 5. Workload with no zone      | ```protect zone list``` + <br/> ```kubectl get pod -n customer-c recommendation-c -o yaml```  | ```submit recommendation-c```                   |
| 6. Kernel it actually runs    | ```kubectl exec recommendation-c -- cat /proc/version```   | ```submit 6.1.0-edera-host```                   |
