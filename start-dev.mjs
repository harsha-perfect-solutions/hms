import { spawn, execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
              console.log(`\x1b[33m[PortManager] Freed port ${targetPort} (stopped stale PID ${pid})\x1b[0m`);
            } catch {}
          }
        }
      }
    }
  } catch {
    // Port is free
  }
}

function terminateTree(proc) {
  if (!proc || !proc.pid) return;
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /F /T /PID ${proc.pid}`, { stdio: 'ignore' });
    } else {
      proc.kill('SIGINT');
    }
  } catch {}
}

console.log('\x1b[36m=== Launching HMS Application (Backend & Frontend) ===\x1b[0m\n');

// Clean up any stale instances holding the ports before starting
freePort(5001);
freePort(5173);

function startProcess(name, cmd, args, cwd, color) {
  const proc = spawn(cmd, args, {
    cwd,
    shell: true,
    stdio: 'pipe',
  });

  proc.stdout.on('data', (data) => {
    process.stdout.write(`${color}[${name}]\x1b[0m ${data}`);
  });

  proc.stderr.on('data', (data) => {
    process.stderr.write(`${color}[${name}]\x1b[0m ${data}`);
  });

  proc.on('close', (code) => {
    console.log(`${color}[${name}]\x1b[0m exited with code ${code}`);
  });

  return proc;
}

const backend = startProcess('Backend', 'npm', ['run', 'dev'], path.join(__dirname, 'backend'), '\x1b[35m');
const frontend = startProcess('Frontend', 'npm', ['run', 'dev'], path.join(__dirname, 'frontend'), '\x1b[32m');

const shutdown = () => {
  console.log('\n\x1b[33mShutting down all HMS services...\x1b[0m');
  terminateTree(backend);
  terminateTree(frontend);
  freePort(5001);
  freePort(5173);
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
