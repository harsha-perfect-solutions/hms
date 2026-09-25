const { execSync } = require('child_process');

const port = process.argv[2] || '5001';

function freePort(targetPort) {
  try {
    if (process.platform === 'win32') {
      const output = execSync(`netstat -ano | findstr :${targetPort}`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      const lines = output.trim().split('\n');
      for (const line of lines) {
        if (line.includes('LISTENING')) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && pid !== '0' && pid !== String(process.pid)) {
            try {
              execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
              console.log(`[HMS PortManager] Freed port ${targetPort} (stopped process ${pid})`);
            } catch {}
          }
        }
      }
    }
  } catch {
    // Port is already free
  }
}

freePort(port);
