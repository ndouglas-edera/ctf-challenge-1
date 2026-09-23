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

## Answers

| Objective                     | Command that yields it                                     | Answer                                          |
| :---------------------------- | :--------------------------------------------------------: | ----------------------------------------------: |
| 1. Zone kernel image          | ```kubectl describe pod image-processor-a```               | ```submit ghcr.io/edera-dev/zone-kernel:6.15``` |
| 2. Cached digest              | ```protect image list --output table```                    | ```submit sha256:8c4f2a91…```                   |
| 3. Kernel variant             | ```protect image list-kernel-variants```                   | ```submit ebpf```                               |
| 4. Failed zone                | ```protect zone list --selector status.state=failed```     | ```submit zone-analytics-d```                   |
| 5. Workload with no zone      | ```protect zone list``` + ```kubectl get pod … -o yaml```  | ```submit recommendation-c```                   |
| 6. Kernel it actually runs    | ```kubectl exec recommendation-c -- cat /proc/version```   | ```submit 6.1.0-edera-host```                   |
