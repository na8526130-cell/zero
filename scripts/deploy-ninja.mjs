import net from 'net';
import fs from 'fs';
import path from 'path';

const FTP_HOST = 'ftp.homepage.shinobi.jp';
const FTP_PORT = 21;
const FTP_USER = 'tomo.fuma-kotaro.com';
const FTP_PASS = 'ebf94335d2b79c42ea1946c81403d388';
const DIST_DIR = path.resolve('dist');

class SimpleFtpClient {
  constructor() {
    this.socket = null;
    this.buffer = '';
    this.pendingResolvers = [];
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.socket = net.createConnection({ host: FTP_HOST, port: FTP_PORT }, () => {
        console.log(`[FTP] Connected to ${FTP_HOST}:${FTP_PORT}`);
      });
      this.socket.on('error', reject);
      this.socket.on('data', (data) => this._onData(data));
      this._waitResponse().then((resp) => {
        if (resp.code === 220) resolve(resp);
        else reject(new Error(`Unexpected greeting: ${resp.raw}`));
      }).catch(reject);
    });
  }

  _onData(data) {
    this.buffer += data.toString('utf8');
    const lines = this.buffer.split('\r\n');
    this.buffer = lines.pop(); // keep remainder
    for (const line of lines) {
      if (!line) continue;
      // Match standard FTP response: 3 digits followed by space or hyphen
      const m = line.match(/^(\d{3})(?:[ -])(.*)$/);
      if (m && this.pendingResolvers.length > 0) {
        const code = parseInt(m[1], 10);
        // Multiline responses have '-' after code; single line has ' '
        const isMulti = line.charAt(3) === '-';
        if (!isMulti) {
          const resolver = this.pendingResolvers.shift();
          resolver({ code, text: m[2], raw: line });
        }
      }
    }
  }

  _waitResponse() {
    return new Promise((resolve) => {
      this.pendingResolvers.push(resolve);
    });
  }

  async sendCmd(cmd) {
    console.log(`[FTP] >> ${cmd.startsWith('PASS') ? 'PASS ********' : cmd}`);
    this.socket.write(cmd + '\r\n');
    const resp = await this._waitResponse();
    console.log(`[FTP] << ${resp.code} ${resp.text}`);
    return resp;
  }

  async login(user, pass) {
    const uResp = await this.sendCmd(`USER ${user}`);
    if (uResp.code === 331) {
      const pResp = await this.sendCmd(`PASS ${pass}`);
      if (pResp.code === 230) {
        console.log('[FTP] Login successful!');
        return true;
      }
    }
    throw new Error(`Login failed: ${uResp.raw}`);
  }

  async setBinary() {
    const resp = await this.sendCmd('TYPE I');
    return resp.code === 200;
  }

  async getPassiveSocket() {
    const resp = await this.sendCmd('PASV');
    if (resp.code !== 227) throw new Error(`PASV failed: ${resp.raw}`);
    const m = resp.raw.match(/\((\d+),(\d+),(\d+),(\d+),(\d+),(\d+)\)/);
    if (!m) throw new Error(`Could not parse PASV response: ${resp.raw}`);
    const ip = `${m[1]}.${m[2]}.${m[3]}.${m[4]}`;
    const port = (parseInt(m[5], 10) << 8) + parseInt(m[6], 10);
    return new Promise((resolve, reject) => {
      const dataSock = net.createConnection({ host: ip, port }, () => resolve(dataSock));
      dataSock.on('error', reject);
    });
  }

  async createDir(dirName) {
    const resp = await this.sendCmd(`MKD ${dirName}`);
    // 257 = created, 550 = already exists
    return resp.code === 257 || resp.code === 550;
  }

  async ensureConnected() {
    if (!this.socket || this.socket.destroyed) {
      console.log('[FTP] Reconnecting control socket...');
      this.buffer = '';
      this.pendingResolvers = [];
      await this.connect();
      await this.login(FTP_USER, FTP_PASS);
      await this.setBinary();
    }
  }

  async uploadFile(localPath, remotePath, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.ensureConnected();
        const dataSock = await this.getPassiveSocket();
        const cmdPromise = this.sendCmd(`STOR ${remotePath}`);
        
        // Send file contents through data connection
        await new Promise((resolve, reject) => {
          const readStream = fs.createReadStream(localPath);
          readStream.on('error', reject);
          dataSock.on('error', reject);
          dataSock.on('close', resolve);
          readStream.pipe(dataSock);
        });

        const resp = await cmdPromise;
        if (resp.code !== 226 && resp.code !== 150) {
          // In case 150 arrived before STOR returned, wait for 226
          const finalResp = await this._waitResponse();
          if (finalResp.code !== 226) {
            throw new Error(`Upload failed for ${remotePath}: ${finalResp.raw}`);
          }
        } else if (resp.code === 150) {
          const finalResp = await this._waitResponse();
          if (finalResp.code !== 226) {
            throw new Error(`Upload failed for ${remotePath}: ${finalResp.raw}`);
          }
        }
        console.log(`[FTP] ✅ Uploaded: ${remotePath} (${(fs.statSync(localPath).size / 1024).toFixed(1)} KB)`);
        return;
      } catch (err) {
        console.warn(`[FTP] ⚠️ Attempt ${attempt} failed for ${remotePath}: ${err.message}`);
        try {
          if (this.socket) this.socket.destroy();
        } catch {}
        this.socket = null;
        this.buffer = '';
        this.pendingResolvers = [];
        if (attempt === maxRetries) throw err;
        await new Promise((r) => setTimeout(r, 1200));
      }
    }
  }

  async close() {
    try {
      this.socket.write('QUIT\r\n');
    } catch {}
    setTimeout(() => {
      if (this.socket) this.socket.destroy();
    }, 500);
  }
}

async function collectFiles(dir, baseDir = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.join(baseDir, entry.name);
    if (entry.isDirectory()) {
      // Skip server-only output file if present
      if (entry.name === 'server') continue;
      results.push({ isDir: true, path: relPath });
      results.push(...(await collectFiles(fullPath, relPath)));
    } else {
      // Skip server.cjs, map files, and user screenshot attachments
      if (entry.name.endsWith('.cjs') || entry.name.endsWith('.cjs.map') || entry.name.includes('image_d56dfb9a')) continue;
      results.push({ isDir: false, fullPath, path: relPath });
    }
  }
  return results;
}

async function runDeploy() {
  console.log('====================================================');
  console.log('🚀 忍者ホームページ (tomo.fuma-kotaro.com) 自動デプロイ');
  console.log('====================================================');
  
  if (!fs.existsSync(DIST_DIR)) {
    throw new Error('dist directory not found. Please run "npm run build" first.');
  }

  const files = await collectFiles(DIST_DIR);
  console.log(`[Deploy] Found ${files.filter(f => !f.isDir).length} files to upload.`);

  const client = new SimpleFtpClient();
  await client.connect();
  await client.login(FTP_USER, FTP_PASS);
  await client.setBinary();

  // Create remote directories first
  for (const item of files) {
    if (item.isDir) {
      console.log(`[Deploy] Ensuring remote directory: ${item.path}`);
      await client.createDir(item.path.replace(/\\/g, '/'));
    }
  }

  // Upload files
  for (const item of files) {
    if (!item.isDir) {
      const remoteName = item.path.replace(/\\/g, '/');
      console.log(`[Deploy] Uploading ${remoteName}...`);
      await client.uploadFile(item.fullPath, remoteName);
    }
  }

  await client.close();
  console.log('====================================================');
  console.log('🎉 デプロイ完了！');
  console.log('公開URL: http://tomo.fuma-kotaro.com/');
  console.log('====================================================');
  setTimeout(() => process.exit(0), 500);
}

runDeploy().catch((err) => {
  console.error('Deploy failed:', err);
  process.exit(1);
});
