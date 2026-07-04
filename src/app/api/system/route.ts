import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import os from 'os';

export const GET = withAuth(async (request: NextRequest) => {
  try {
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const cpus = os.cpus();

    const loadAvg = os.loadavg();
    const uptimeSeconds = process.uptime();
    const days = Math.floor(uptimeSeconds / 86400);
    const hours = Math.floor((uptimeSeconds % 86400) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);

    return NextResponse.json({
      success: true,
      data: {
        cpu: {
          model: cpus[0]?.model || 'Unknown',
          cores: cpus.length,
          speed: cpus[0]?.speed || 0,
          loadAvg: { '1m': loadAvg[0], '5m': loadAvg[1], '15m': loadAvg[2] },
        },
        memory: {
          total: totalMem,
          used: usedMem,
          free: freeMem,
          usagePercent: Math.round((usedMem / totalMem) * 100),
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal,
          rss: memUsage.rss,
        },
        disk: { note: 'Disk stats require filesystem access; use host monitoring for accurate data' },
        uptime: { seconds: Math.floor(uptimeSeconds), formatted: `${days}d ${hours}h ${minutes}m` },
        os: { platform: os.platform(), arch: os.arch(), hostname: os.hostname(), release: os.release() },
        runtime: { nodeVersion: process.version, pid: process.pid },
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get system info' },
      { status: 500 }
    );
  }
});
