const { spawn, spawnSync } = require('child_process');

const isWindows = process.platform === 'win32';
const yarnCommand = isWindows ? 'yarn.cmd' : 'yarn';
const hasYarn = spawnSync(yarnCommand, ['--version'], {
  stdio: 'ignore',
}).status === 0;
const command = hasYarn ? yarnCommand : (isWindows ? 'corepack.cmd' : 'corepack');
const commandPrefix = hasYarn ? [] : ['yarn'];

const processes = [
  {
    name: 'backend',
    args: ['workspace', 'english-learning-backend', 'run', 'dev'],
  },
  {
    name: 'worker',
    args: ['workspace', 'english-learning-backend', 'run', 'worker'],
  },
  {
    name: 'frontend',
    args: ['workspace', 'english-learning-frontend', 'run', 'dev'],
  },
];

const children = processes.map(({ name, args }) => {
  const child = spawn(command, [...commandPrefix, ...args], {
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

  return child;
});

let stopping = false;

function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGINT');
    }
  }

  setTimeout(() => process.exit(exitCode), 300);
}

for (const child of children) {
  child.on('exit', (code, signal) => {
    if (stopping) return;

    const exitCode = typeof code === 'number' ? code : 1;
    const reason = signal ? `signal ${signal}` : `code ${exitCode}`;
    console.error(`\nA development service stopped (${reason}). Stopping the other service.`);
    stop(exitCode || 1);
  });
}

process.on('SIGINT', () => {
  stop(0);
});

process.on('SIGTERM', () => {
  stop(0);
});
