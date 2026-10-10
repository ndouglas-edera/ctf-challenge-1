# CTF Challenge 1
This is our first ever CTF-style challenge to discover security shortfalls of a shared Linux kernel in Kubernetes. <br/>
https://ndouglas-edera.github.io/ctf-challenge-1/

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
Edera supports heterogeneous, mixed-workload clusters, but running mixed runtime classes on the same individual node is discouraged due to resource management trade-offs. Find the pod that has no assigned **[runtimeClassName](https://kubernetes.io/docs/concepts/containers/runtime-class/#usage)**.
```
kubectl describe pod -n customer-c   recommendation-c
```
Technically, an Edera-enabled node retains the default ```containerd``` runtime alongside the Edera runtime handler in its ```CRI``` configuration. However, running both isolated Edera pods and standard containers side-by-side on the exact same physical or virtual node leads to operational friction:
<br/><br/>
Edera partitions host resources between ```dom0``` (the host system context) and ```domU``` (the isolated zone execution context). By default, ```dom0``` receives a constrained fraction of node memory (**~35%**). Running standard workloads in ```dom0``` can trigger out-of-memory (OOM) evictions before ```kubelet``` detects node-level memory pressure.

## Flag 2
Edera caches container images locally for faster workload launches. <br/>
There are several ways to list cached images, depending on your needs:
```
protect image list
```
```
protect image list --output json-pretty
```
```
protect image list --output table
```
Edera supports multiple image formats:
- ```squashfs``` (default) - Compressed, read-only filesystem
- ```tar``` - Standard tar archive
- ```directory``` - Uncompressed directory

Use ```squashfs``` for **production** environments. <br/>
Use ```directory``` for **development** and **debugging**.

## Flag 3
**[Kernel variants](https://docs.edera.dev/guides/kernel/kernel-variants/)** are alternate zone kernel images with different features or extra capabilities or drivers. The daemon resolves from its ```[zone.kernel-variants]``` configuration. A kernel variant is a named, alternate zone kernel with different configuration or features than the default zone kernel. It is not necessary to specify a kernel variant most of the time, as Edera’s default zone kernel is generic, hardened, and supports all baseline features. Some features, such as GPU support, specifically require alternate kernel variants.
<br/><br/>
To list the usable kernel variants currently recognised by the daemon:
```
protect image list-kernel-variants
```
Those are the variants accepted by ```zone launch --kernel-variant``` and the ````dev.edera/kernel-variant```` pod annotation. Kernel variants are always referenced by their name, such as nvidia, and are defined in the Edera daemon’s ```daemon.toml``` in the ```[zone.kernel-variants]``` section of the **[Edera Docs](https://docs.edera.dev/guides/kernel/kernel-variants/#use-a-variant-in-kubernetes)**. 
<br/><br/>
Each variant name maps to a specific OCI image that contains that kernel. Edera ships with some default kernel variants, additional variants may be defined by the user. In a real-world scenario, you may want to host your own kernels in an OCI registry, and define your own site-local kernel variants as well.

## Flag 4
Insert Description.

<br/><br/>

## Answers

| Objective                     | Commands                                      | Answer |
| :---------------------------- | :-----------------------------------------------------------: | -----: |
| 1. Zone kernel image          | `kubectl describe pod image-processor-a -n customer-a`       | `submit ghcr.io/edera-dev/zone-kernel:6.15` |
| 2. Cached digests             | `protect image list`                                          | <code>submit sha256:8c4f2a91...</code> |
| 3. Kernel variants            | `protect image list-kernel-variants`                          | `submit ebpf` |
| 4. Failed zone                | `protect zone list --selector status.state=failed`            | `submit zone-analytics-d` |
| 5. List zones                 | `protect zone list`                                           | |
| 5. List workloads             | `protect workload list`                                       | |
| 5. Find workload without zone | `kubectl get pod -n customer-c recommendation-c -o yaml`    | `submit recommendation-c` |
| 6. Launch a zone              | `protect zone launch --name my-zone`                          | |
| 6. Launch pod in zone         | `protect workload launch --zone my-zone --name web-server nginx:latest` | |
| 6. Check the logs             | `protect zone logs my-zone --follow`                          | `submit EDERA{ZONE_WORKLOAD_LAUNCH}` |
