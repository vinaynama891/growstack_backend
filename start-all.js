const { spawn } = require('child_process');
const net = require('net');
const path = require('path');
const fs = require('fs');

// Configuration
const MONGO_PORT = 27017;
const DB_PATH = path.join(__dirname, 'db');

/**
 * Check if a port is currently in use
 */
function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer()
      .once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          resolve(true);
        } else {
          resolve(false);
        }
      })
      .once('listening', () => {
        server.close();
        resolve(false);
      });
    server.listen(port, '127.0.0.1');
  });
}

async function start() {
  console.log('===================================================');
  console.log('    GROWSTACK 3D - INTEGRATED DB & SERVER STARTUP  ');
  console.log('===================================================');

  // Check if MongoDB port is active
  console.log(`[Status] Checking port ${MONGO_PORT} for active MongoDB instance...`);
  const isMongoRunning = await isPortInUse(MONGO_PORT);

  let mongoProcess = null;

  if (isMongoRunning) {
    console.log(`[Status] MongoDB is already active on port ${MONGO_PORT}. Utilizing active instance.`);
  } else {
    console.log('[Status] MongoDB is offline. Starting local MongoDB daemon...');

    // Ensure local db path directory exists
    if (!fs.existsSync(DB_PATH)) {
      console.log(`[Database] Database directory missing. Creating at: ${DB_PATH}`);
      fs.mkdirSync(DB_PATH, { recursive: true });
    }

    // Launch mongod daemon process pointing to server/db
    console.log(`[Database] Launching daemon: mongod --dbpath "${DB_PATH}" --port ${MONGO_PORT}`);
    mongoProcess = spawn('mongod', ['--dbpath', DB_PATH, '--port', MONGO_PORT.toString()], {
      stdio: 'ignore', // Run silently in background, output can be noisy
      shell: true
    });

    mongoProcess.on('error', (err) => {
      console.error('[Error] Failed to start MongoDB daemon:', err);
      console.error('[Error] Please ensure `mongod` is installed and set in your environment PATH.');
      process.exit(1);
    });

    // Wait for DB server synchronization
    console.log('[Database] Synchronizing connection pool (waiting 3 seconds)...');
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  // Determine production/development mode
  const isProd = process.env.NODE_ENV === 'production' || process.argv.includes('--prod');
  const env = { ...process.env };
  env.NODE_ENV = isProd ? 'production' : 'development';

  console.log(`[App] Spawning Express server in ${env.NODE_ENV.toUpperCase()} mode...`);

  // Launch server.js in the same directory
  const serverCmd = isProd ? 'node' : 'npx nodemon';
  const serverScript = path.join(__dirname, 'server.js');
  
  console.log(`[App] Executing: ${serverCmd} "${serverScript}"`);
  
  const serverProcess = spawn(serverCmd, [serverScript], {
    stdio: 'inherit',
    env,
    shell: true
  });

  serverProcess.on('exit', (code) => {
    console.log(`[App] Server process exited with code ${code}`);
    cleanup();
  });

  // Graceful shutdown helper
  const cleanup = () => {
    if (mongoProcess) {
      console.log('[Database] Stopping local MongoDB daemon...');
      mongoProcess.kill();
    }
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

start().catch((err) => {
  console.error('[Startup Error] Failed to initialize services:', err);
  process.exit(1);
});
