import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';

const port = Number(process.env.PORT ?? 5173);
const useHttpOnly = process.env.VITE_HTTP_ONLY === '1' || process.env.HTTP_ONLY === '1';
const upstream = process.env.NGROK_ADDR || `${useHttpOnly ? 'http' : 'https'}://localhost:${port}`;
const authtoken = process.env.NGROK_AUTHTOKEN || process.env.NGROK_TOKEN || '4vgFf4PUCBH3aAxJgrzHE_3MKtZoYqFRbHf8bAfxNHF';
const subdomain = process.env.NGROK_SUBDOMAIN || process.env.SUBDOMAIN || undefined;
const region = process.env.NGROK_REGION || undefined; // e.g., us, eu, ap
const bin = path.join(process.cwd(), 'node_modules', '.bin', 'ngrok');
const configPath = path.join(process.cwd(), '.ngrok.yml');

function ensureConfig() {
  const contents = `version: "2"\nauthtoken: ${authtoken}\n`;
  fs.writeFileSync(configPath, contents, 'utf8');
}

function run() {
  ensureConfig();

  const args = ['http', upstream, '--config', configPath];
  if (subdomain) {
    args.push('--hostname', `${subdomain}.ngrok.io`);
  }
  if (region) {
    args.push('--region', region);
  }
  args.push('--host-header=rewrite');

  console.log(`Starting ngrok to ${upstream} ...`);
  const child = spawn(bin, args, { stdio: 'inherit' });
  child.on('exit', (code) => {
    console.log(`ngrok exited with code ${code ?? 0}`);
  });
}

run();
