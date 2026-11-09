/// <reference types="node" />
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { request } from 'node:http';
import { resolve } from 'node:path';
import type { FetchImplementation } from '@/api/transport';

export type MockServer = { baseURL: string; stop(): Promise<void> };

// A real HTTP adapter keeps integration tests independent of Jest's RN fetch polyfills.
export const nodeFetch: FetchImplementation = (url, init) =>
  new Promise((resolveResponse, reject) => {
    const req = request(
      url,
      { method: init.method, headers: init.headers, signal: init.signal },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('error', reject);
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          resolveResponse({
            status: res.statusCode ?? 0,
            headers: {
              get: (name) => {
                const value = res.headers[name.toLowerCase()];
                return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
              },
            },
            json: () => {
              const value: unknown = JSON.parse(body);
              return Promise.resolve(value);
            },
          });
        });
      }
    );
    req.on('error', reject);
    req.end(init.body);
  });

function stopProcess(child: ChildProcess): Promise<void> {
  return new Promise((resolveStop) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolveStop();
      return;
    }
    const force = setTimeout(() => child.kill('SIGKILL'), 2000);
    child.once('exit', () => {
      clearTimeout(force);
      resolveStop();
    });
    child.kill('SIGTERM');
  });
}

export async function startMockServer(): Promise<MockServer> {
  // Port 0 asks the OS for an isolated port; the service logs its configured 0,
  // so the child announces the actual bound address after listen completes.
  const serverPath = resolve(__dirname, '../../mock/server.js');
  const bootstrap = `const http = require('http'); const listen = http.Server.prototype.listen; http.Server.prototype.listen = function (...args) { this.once('listening', () => console.log('TEST_PORT=' + this.address().port)); return listen.apply(this, args); }; process.argv[2] = '0'; require(process.argv[1]);`;
  const child = spawn(process.execPath, ['-e', bootstrap, serverPath], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    const port = await new Promise<number>((resolvePort, reject) => {
      let output = '';
      let errors = '';
      const timeout = setTimeout(
        () => reject(new Error(`Mock startup timed out: ${errors}`)),
        5000
      );
      child.stderr.on('data', (chunk: Buffer) => {
        errors += chunk.toString();
      });
      child.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      child.once('exit', (code) => {
        clearTimeout(timeout);
        reject(new Error(`Mock exited ${code}: ${errors}`));
      });
      child.stdout.on('data', (chunk: Buffer) => {
        output += chunk.toString();
        const match = /TEST_PORT=(\d+)/.exec(output);
        if (match?.[1]) {
          clearTimeout(timeout);
          resolvePort(Number(match[1]));
        }
      });
    });
    return { baseURL: `http://127.0.0.1:${port}`, stop: () => stopProcess(child) };
  } catch (error: unknown) {
    await stopProcess(child);
    throw error;
  }
}
