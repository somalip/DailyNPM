import os from 'os';
import fs from 'fs/promises';
import path from 'path';

export interface SystemCheckResult {
  isCapable: boolean;
  reason?: string;
}

export async function checkSystemRequirements(): Promise<SystemCheckResult> {
  // 1. Check RAM (Minimum 4GB Total)
  // Note: We intentionally avoid os.freemem() because macOS heavily utilizes RAM for
  // disk caching (file cache). This causes os.freemem() to incorrectly report near 0
  // even when gigabytes of cache can be instantly evicted for application use.
  const totalRamGB = os.totalmem() / (1024 ** 3);

  if (totalRamGB < 3.5) {
    return { isCapable: false, reason: `Insufficient total RAM (${totalRamGB.toFixed(1)}GB). Minimum 4GB required.` };
  }

  // 2. Check Storage Space (Minimum 200MB Free)
  try {
    const cachePath = path.join(os.homedir(), '.cache');
    // Ensure cache path exists for statfs
    await fs.mkdir(cachePath, { recursive: true });
    
    // Node.js fs.promises.statfs is available in Node 18.15+
    if (typeof fs.statfs === 'function') {
      const stats = await fs.statfs(cachePath);
      // bavail is free blocks available to unprivileged user, bsize is block size
      const freeBytes = stats.bavail * stats.bsize;
      const freeMB = freeBytes / (1024 ** 2);

      if (freeMB < 200) {
        return { isCapable: false, reason: `Insufficient disk space (${freeMB.toFixed(0)}MB free). Minimum 200MB required.` };
      }
    }
  } catch (err) {
    // If statfs fails (unsupported Node version or permissions), we gracefully continue
    console.warn("Could not check disk space, skipping storage requirement check.", err);
  }

  // CPU Cores check just for logging, we don't strictly enforce a block unless they have 1 core (which is rare)
  const cpuCores = os.cpus().length;
  if (cpuCores < 2) {
    return { isCapable: false, reason: `Insufficient CPU cores (${cpuCores}). Minimum 2 cores required.` };
  }

  return { isCapable: true };
}
