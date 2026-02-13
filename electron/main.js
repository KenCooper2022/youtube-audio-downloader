const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let serverProcess;

const isDev = process.env.NODE_ENV === 'development';
const PORT = 5000;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#ffffff',
  });

  const startUrl = `http://localhost:${PORT}`;
  
  mainWindow.loadURL(startUrl);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startServer() {
  return new Promise((resolve, reject) => {
    let serverCommand, serverArgs, serverCwd;
    
    if (isDev) {
      serverCommand = 'npx';
      serverArgs = ['tsx', 'server/index.ts'];
      serverCwd = path.join(__dirname, '..');
    } else {
      const serverPath = path.join(process.resourcesPath, 'server', 'index.cjs');
      serverCommand = 'node';
      serverArgs = [serverPath];
      serverCwd = process.resourcesPath;
    }
    
    serverProcess = spawn(serverCommand, serverArgs, {
      env: {
        ...process.env,
        NODE_ENV: isDev ? 'development' : 'production',
        PORT: PORT.toString(),
      },
      cwd: serverCwd,
      shell: true,
    });

    serverProcess.stdout.on('data', (data) => {
      console.log(`Server: ${data}`);
      if (data.toString().includes('serving on port')) {
        resolve();
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(`Server Error: ${data}`);
    });

    serverProcess.on('error', (err) => {
      console.error('Failed to start server:', err);
      reject(err);
    });

    setTimeout(resolve, 3000);
  });
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
}

app.whenReady().then(async () => {
  try {
    await startServer();
    createWindow();
  } catch (err) {
    console.error('Failed to start application:', err);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  stopServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', () => {
  stopServer();
});
