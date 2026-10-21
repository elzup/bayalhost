#!/usr/bin/env node
import {
  existsSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runDeploy, siteStatus, syncProject, syncSites } from './sites.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const repoDir = path.resolve(scriptDir, '..');
const configPath = path.join(repoDir, 'bayalhost.config.json');
const artifactNames = ['out', 'dist', 'build'];

const printUsage = () => {
  console.log(`Usage:
  scripts/bayalhost.mjs list
  scripts/bayalhost.mjs scan [root]
  scripts/bayalhost.mjs add <name> <artifact-path> [--source <path>] [--env <path>]
  scripts/bayalhost.mjs deploy <name>
  scripts/bayalhost.mjs sync        # make sites/<name>/current match the config
  scripts/bayalhost.mjs validate
`);
};

const readJson = (filePath) => JSON.parse(readFileSync(filePath, 'utf8'));

const writeJson = (filePath, value) => {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
};

const readConfig = () => readJson(configPath);

const assertProjectName = (name) => {
  if (!/^[a-z0-9-]+$/.test(name)) {
    throw new Error(`Invalid project name: ${name}`);
  }
};

const assertArtifact = (artifactPath) => {
  if (!existsSync(artifactPath) || !statSync(artifactPath).isDirectory()) {
    throw new Error(`artifact directory does not exist: ${artifactPath}`);
  }

  const indexPath = path.join(artifactPath, 'index.html');
  if (!existsSync(indexPath)) {
    throw new Error(`artifact directory must contain index.html: ${artifactPath}`);
  }
};

const parseOptions = (args) => {
  const options = {};
  const positional = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--source' || arg === '--env') {
      const value = args[index + 1];
      if (!value) {
        throw new Error(`${arg} requires a value`);
      }
      options[arg.slice(2)] = value;
      index += 1;
      continue;
    }

    positional.push(arg);
  }

  return { options, positional };
};

const listProjects = () => {
  const config = readConfig();

  for (const project of config.projects) {
    console.log(`${project.name}\t${describeStatus(project)}\t${project.artifact}`);
  }
};

const findArtifacts = (root) => {
  const artifacts = [];
  const rootPath = path.resolve(root);

  if (!existsSync(rootPath)) {
    throw new Error(`scan root does not exist: ${rootPath}`);
  }

  const ownerEntries = readdirSync(rootPath, { withFileTypes: true });

  for (const entry of ownerEntries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) {
      continue;
    }

    const sourcePath = path.join(rootPath, entry.name);

    for (const artifactName of artifactNames) {
      const artifactPath = path.join(sourcePath, artifactName);
      const indexPath = path.join(artifactPath, 'index.html');

      if (existsSync(indexPath)) {
        artifacts.push({
          name: entry.name.toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
          source: sourcePath,
          artifact: artifactPath,
        });
      }
    }
  }

  return artifacts;
};

const scanProjects = (rootArg) => {
  const config = readConfig();
  const roots = rootArg ? [rootArg] : config.scanRoots;
  const registered = new Set(config.projects.map((project) => realpathOrSelf(project.artifact)));

  for (const root of roots) {
    for (const artifact of findArtifacts(root)) {
      const marker = registered.has(realpathOrSelf(artifact.artifact)) ? 'registered' : 'candidate';
      console.log(`${marker}\t${artifact.name}\t${artifact.artifact}`);
    }
  }
};

const realpathOrSelf = (targetPath) => {
  try {
    return realpathSync(targetPath);
  } catch {
    return targetPath;
  }
};

const addProject = (args) => {
  const { options, positional } = parseOptions(args);
  const [name, artifactPathArg] = positional;

  if (!name || !artifactPathArg) {
    throw new Error('add requires <name> and <artifact-path>');
  }

  assertProjectName(name);

  const artifactPath = path.resolve(artifactPathArg);
  assertArtifact(artifactPath);

  const config = readConfig();
  const existingIndex = config.projects.findIndex((project) => project.name === name);
  // 既存エントリの live / auth 等、フォームで扱わないフィールドを落とさない
  const project = {
    ...config.projects[existingIndex],
    name,
    source: path.resolve(options.source ?? path.dirname(artifactPath)),
    artifact: artifactPath,
    envFile: options.env ? path.resolve(options.env) : '',
    type: 'static',
    enabled: true,
  };

  const projects = existingIndex === -1
    ? [...config.projects, project]
    : config.projects.map((currentProject, index) => index === existingIndex ? project : currentProject);

  writeJson(configPath, { ...config, projects });
  console.log(`${existingIndex === -1 ? 'Added' : 'Updated'} ${name}`);
  console.log(syncProject(project) ?? `${name}: sites/ already up to date`);
};

const deployProject = (name) => {
  if (!name) {
    throw new Error('deploy requires <name>');
  }

  const config = readConfig();
  const project = config.projects.find((currentProject) => currentProject.name === name);

  if (!project) {
    throw new Error(`project is not registered: ${name}`);
  }

  if (!project.enabled) {
    throw new Error(`project is disabled: ${name}`);
  }

  assertArtifact(project.artifact);

  // live は artifact を直配信するので deploy するものが無い。symlink の張り直しだけ行う
  if (project.live) {
    console.log(syncProject(project) ?? `${name}: live, already serving ${project.artifact}`);
    return;
  }

  console.log(runDeploy(project));
};

const syncAll = () => {
  const changes = syncSites(readConfig().projects);
  console.log(changes.length > 0 ? changes.join('\n') : 'OK: sites/ already matches config');
};

const formatMtime = (mtime) => (mtime === null ? '-' : new Date(mtime).toISOString().slice(0, 16));

const describeStatus = (project) => {
  const status = siteStatus(project);
  const flags = [
    !project.enabled && 'disabled',
    status.isMissing && 'MISSING',
    !status.isInSync && 'OUT-OF-SYNC (run sync)',
    status.isStale && 'STALE (deploy)',
  ].filter(Boolean);
  return `${status.mode}\tserved ${formatMtime(status.servedMtime)}\tartifact ${formatMtime(status.artifactMtime)}\t${flags.join(', ') || 'ok'}`;
};

const validateConfig = () => {
  const config = readConfig();
  const names = new Set();

  for (const project of config.projects) {
    assertProjectName(project.name);
    assertArtifact(project.artifact);

    if (names.has(project.name)) {
      throw new Error(`duplicate project name: ${project.name}`);
    }

    if (project.envFile && !existsSync(project.envFile)) {
      throw new Error(`env file does not exist for ${project.name}: ${project.envFile}`);
    }

    names.add(project.name);
  }

  console.log(`OK: ${config.projects.length} project(s)`);
};

const main = () => {
  const [command, ...args] = process.argv.slice(2);

  if (!command || command === 'help' || command === '--help') {
    printUsage();
    return;
  }

  if (command === 'list') {
    listProjects();
    return;
  }

  if (command === 'scan') {
    scanProjects(args[0]);
    return;
  }

  if (command === 'add') {
    addProject(args);
    return;
  }

  if (command === 'deploy') {
    deployProject(args[0]);
    return;
  }

  if (command === 'sync') {
    syncAll();
    return;
  }

  if (command === 'validate') {
    validateConfig();
    return;
  }

  throw new Error(`unknown command: ${command}`);
};

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
