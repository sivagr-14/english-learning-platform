const { spawn } = require('child_process');

const isWindows = process.platform === 'win32';
const yarn = isWindows ? 'yarn.cmd' : 'yarn';

const processes = [
  {
    name: 'backend',
    args: ['workspace', 'english-learning-backend', 'run', 'dev'],
  },
  {
    name: 'frontend',
    args: ['workspace', 'english-learning-frontend', 'run', 'dev'],
  },
];

const children = processes.map(({ name, args }) => {
  const child = spawn(yarn, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (data) => {
    process.stdout.write(`[${name}] ${data}`);
  });

  child.stderr.on('data', (data) => {
    process.stderr.write(`[${name}] ${data}`);
  });

  child.on('exit', (code) => {
    if (code && code !== 0) {
      process.exitCode = code;
    }
  });

  return child;
});

function stop() {
  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGINT');
    }
  }
}

process.on('SIGINT', () => {
  stop();
  setTimeout(() => process.exit(), 250);
});

process.on('SIGTERM', () => {
  stop();
  setTimeout(() => process.exit(), 250);
});
