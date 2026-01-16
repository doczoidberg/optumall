# Calculation Kernel

## Overview
The calculation kernel is a standalone executable that performs compute-intensive simulations on Google Compute Engine VMs. It reads mesh files and project configuration, executes the workload, and produces result artifacts. The kernel is designed to run headless in cloud environments and integrates with the VM provisioning workflow.

## Deployment
The calculation kernel executable (`calculationKernel.exe` or `calculationKernel`) is deployed onto provisioned VMs as part of the startup script or VM image. When a VM is created via `createCompute`, the kernel is invoked automatically with the appropriate parameters.

## Command-Line Interface

### Syntax
```bash
calculationKernel.exe --projectFile <PROJECT_FILE_PATH> --meshFile <MESH_FILE_PATH>
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `--projectFile` | string | ✅ | Absolute path or `gs://` URL to the project bundle uploaded via `uploadFile`. Contains project definition, solver parameters, material properties, timestep counts, etc. The kernel will download the file from Cloud Storage if a `gs://` path is provided. |
| `--meshFile` | string | ✅ | Absolute path or `gs://` URL to the mesh file uploaded via `uploadFile`. The kernel will download the file from Cloud Storage if a `gs://` path is provided. |
| `--outputDir` | string | ❌ | Directory where result artifacts are written. Defaults to `./output`. |
| `--logLevel` | string | ❌ | Log verbosity: `debug`, `info`, `warn`, `error`. Defaults to `info`. |

### Example Usage

```bash
# Basic execution
./calculationKernel.exe \
  --projectFile gs://optum-80593.appspot.com/projects/wing42/T22VDtiCN81Ryjvawibt/1730408123400-project.zip \
  --meshFile gs://optum-80593.appspot.com/projects/wing42/T22VDtiCN81Ryjvawibt/1730408123456-wing.mesh

# With custom output directory and log level
./calculationKernel.exe \
  --projectFile /mnt/data/project.zip \
  --meshFile /mnt/data/wing.mesh \
  --outputDir /mnt/results \
  --logLevel debug
```

## Workflow Integration

1. **VM Provisioning**: `createCompute` creates a GCE instance with the kernel pre-installed or mounted.
2. **Startup Script**: The VM startup script downloads the project file and mesh file from the `gs://` paths (stored in VM metadata as `projectFilePath` and `meshFilePath`), and invokes the kernel with both parameters.
3. **Execution**: The kernel runs the simulation workload, logging progress to stdout/stderr.
4. **Results**: Output artifacts are written to the specified `--outputDir` and optionally uploaded back to Cloud Storage.
5. **Cleanup**: The VM is stopped or deleted after completion, with usage logged to Firestore by `scheduledFunction`.

### Result Upload
After writing the output artifacts, the kernel should:

1. Bundle the results (e.g., `.zip` or `.tar.gz`) and upload them to Cloud Storage (either directly via the GCS API or by calling `uploadFile`).
2. Update the corresponding Firestore document (`machines/{vmName}`) with `resultFilePath: "gs://bucket/path/to/output.zip"`.

The `getSimulationResults` endpoint reads this field and generates a signed download URL for the desktop client once the job reaches `state: "completed"`.

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success - simulation completed without errors |
| 1 | Invalid arguments or missing required parameters |
| 2 | Mesh file not found or unable to download from Cloud Storage |
| 3 | Project JSON parsing error |
| 10 | Simulation runtime error (solver failure, divergence, etc.) |
| 99 | Unexpected/unhandled exception |

## Input Format

### Project File
The project file (typically a `.zip` bundle) uploaded via `uploadFile` should contain:
- **project.json**: Main configuration with solver parameters, material properties, timestep counts, etc.
- **Additional assets**: Supporting files like boundary conditions, initial conditions, or solver-specific configuration

Example `project.json` structure:

```json
{
  "name": "wing-sim-42",
  "solver": "optumCFD",
  "timesteps": 2500,
  "material": "alloy-xt-15",
  "convergenceTolerance": 1e-6,
  "outputInterval": 100,
  "notes": "baseline mesh v3"
}
```

### Mesh File
The mesh file format depends on the solver implementation. Common formats include:
- `.mesh` - ASCII or binary mesh format
- `.msh` - Gmsh format
- `.vtk` - VTK unstructured grid
- `.h5` - HDF5 binary mesh

The kernel auto-detects the format based on the file extension and header magic bytes.

## Output Artifacts

Results are written to the `--outputDir` directory:

```
output/
├── results.vtk           # Primary simulation results
├── convergence.csv       # Convergence history
├── performance.json      # Timing and resource usage stats
└── logs/
    └── kernel.log        # Detailed execution log
```

## Cloud Storage Integration

The kernel supports reading project files and mesh files directly from Cloud Storage via `gs://` URLs:

1. Kernel detects the `gs://` prefix in `--projectFile` and `--meshFile`
2. Uses Application Default Credentials (ADC) to authenticate with GCS
3. Downloads the files to a temporary location (e.g., `/tmp/project-<timestamp>.zip`, `/tmp/mesh-<timestamp>.mesh`)
4. Proceeds with simulation using the local copies

Optionally, the kernel can upload results back to Cloud Storage:

```bash
./calculationKernel.exe \
  --projectFile gs://optum-80593.appspot.com/projects/wing42/customer/project.zip \
  --meshFile gs://optum-80593.appspot.com/projects/wing42/customer/mesh.mesh \
  --uploadResults gs://optum-80593.appspot.com/results/wing42/
```

## Logging and Monitoring

- **Console Output**: Progress updates, warnings, and errors are written to stdout/stderr
- **Log File**: Detailed logs are written to `logs/kernel.log` in the output directory
- **Firestore Integration**: The VM startup script can parse kernel output and write status updates to `machines/{vmName}` document
- **Remote Access**: Use the `getComputeState` endpoint with `includeLogs=true` to retrieve kernel log files remotely and monitor simulation progress in real-time

## Performance Characteristics

| Machine Profile | Typical Mesh Size | Expected Runtime |
|----------------|-------------------|------------------|
| `fast` (4 vCPU) | < 100k elements | 15-45 minutes |
| `very fast` (8 vCPU) | 100k-500k elements | 30-90 minutes |
| `fastest` (16 vCPU) | 500k-2M elements | 1-3 hours |

Actual performance varies based on mesh complexity, solver settings, and convergence criteria.

## Error Handling

The kernel validates inputs before starting the simulation:

1. ✅ Check `--projectFile` and `--meshFile` are provided
2. ✅ Verify project file and mesh file exist and are readable
3. ✅ Parse and validate project definition from the project file
4. ✅ Check available disk space for results
5. ✅ Test Cloud Storage connectivity (if using `gs://` paths)

If any validation fails, the kernel exits with a non-zero code and a descriptive error message.

## Dependencies

The kernel requires the following runtime dependencies on the VM:

- **OS**: Linux (Ubuntu 20.04+ or Debian 11+)
- **Libraries**: `libstdc++.so.6`, `libgomp.so.1` (OpenMP), `libgfortran.so.5`
- **Cloud SDK** (optional): `gcloud` CLI for Cloud Storage operations
- **Python 3.8+** (optional): For result post-processing scripts

## Security Considerations

- The kernel runs with the VM's service account credentials
- Ensure the service account has minimal permissions (Storage Object Viewer for mesh files, Object Creator for results)
- Do not embed sensitive data in project JSON; use Firestore or Secret Manager for credentials
- The kernel does not expose network services (no HTTP/RPC endpoints)

## Related Resources

- [createCompute](./createCompute.md) - Provisions VMs that run the calculation kernel
- [uploadFile](./uploadFile.md) - Uploads mesh/project assets referenced by `--projectFile` / `--meshFile`
- [getComputeState](./getComputeState.md) - Monitors VM and kernel execution status
- [getSimulationResults](./getSimulationResults.md) - Desktop clients obtain the signed download link once the kernel uploads results
