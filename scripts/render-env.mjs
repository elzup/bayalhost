#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const [, , envFile, outputFile] = process.argv;

if (!envFile || !outputFile) {
  console.error('Usage: render-env.mjs <env-file> <output-file>');
  process.exit(1);
}

if (!existsSync(envFile)) {
  console.error(`env file does not exist: ${envFile}`);
  process.exit(1);
}

const parseEnvLine = (line) => {
  const trimmedLine = line.trim();

  if (!trimmedLine || trimmedLine.startsWith('#')) {
    return null;
  }

  const separatorIndex = trimmedLine.indexOf('=');
  if (separatorIndex === -1) {
    return null;
  }

  const key = trimmedLine.slice(0, separatorIndex).trim();
  const rawValue = trimmedLine.slice(separatorIndex + 1).trim();

  if (!/^[A-Z0-9_]+$/.test(key)) {
    throw new Error(`Invalid env key: ${key}`);
  }

  const value = rawValue.replace(/^['"]|['"]$/g, '');
  return [key, value];
};

const entries = readFileSync(envFile, 'utf8')
  .split(/\r?\n/)
  .map(parseEnvLine)
  .filter(Boolean);

const env = Object.fromEntries(entries);
const content = `window.__BAYALHOST_ENV__ = ${JSON.stringify(env, null, 2)};\n`;

writeFileSync(outputFile, content);
