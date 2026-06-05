#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  createReadStream,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoDir = path.resolve(scriptDir, '..');
const configPath = path.join(repoDir, 'bayalhost.config.json');
const artifactNames = ['out', 'dist', 'build'];
const port = Number(process.env.BAYALHOST_ADMIN_PORT ?? 8918);
const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.gif', 'image/gif'],
  ['.html', 'text/html; charset=utf-8'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webp', 'image/webp'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

const readConfig = () => JSON.parse(readFileSync(configPath, 'utf8'));
const writeConfig = (config) => writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);

const realpathOrSelf = (targetPath) => {
  try {
    return realpathSync(targetPath);
  } catch {
    return targetPath;
  }
};

const assertProjectName = (name) => {
  if (!/^[a-z0-9-]+$/.test(name)) {
    throw new Error('Project name must match [a-z0-9-]+');
  }
};

const assertArtifact = (artifactPath) => {
  if (!existsSync(artifactPath) || !statSync(artifactPath).isDirectory()) {
    throw new Error(`artifact directory does not exist: ${artifactPath}`);
  }

  if (!existsSync(path.join(artifactPath, 'index.html'))) {
    throw new Error(`artifact directory must contain index.html: ${artifactPath}`);
  }
};

const findArtifacts = (root) => {
  const rootPath = path.resolve(root);
  const artifacts = [];

  if (!existsSync(rootPath)) {
    return artifacts;
  }

  for (const entry of readdirSync(rootPath, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) {
      continue;
    }

    const source = path.join(rootPath, entry.name);

    for (const artifactName of artifactNames) {
      const artifact = path.join(source, artifactName);

      if (existsSync(path.join(artifact, 'index.html'))) {
        artifacts.push({
          name: entry.name.toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
          source,
          artifact,
        });
      }
    }
  }

  return artifacts;
};

const scanProjects = () => {
  const config = readConfig();
  const registered = new Set(config.projects.map((project) => realpathOrSelf(project.artifact)));

  return config.scanRoots.flatMap((root) =>
    findArtifacts(root).map((artifact) => ({
      ...artifact,
      status: registered.has(realpathOrSelf(artifact.artifact)) ? 'registered' : 'candidate',
    })),
  );
};

const addProject = ({ name, source, artifact, envFile }) => {
  assertProjectName(name);
  const artifactPath = path.resolve(artifact);
  assertArtifact(artifactPath);

  const config = readConfig();
  const nextProject = {
    name,
    source: path.resolve(source || path.dirname(artifactPath)),
    artifact: artifactPath,
    envFile: envFile ? path.resolve(envFile) : '',
    type: 'static',
    enabled: true,
  };
  const hasProject = config.projects.some((project) => project.name === name);
  const projects = hasProject
    ? config.projects.map((project) => (project.name === name ? nextProject : project))
    : [...config.projects, nextProject];

  writeConfig({ ...config, projects });
  return nextProject;
};

const deployProject = (name) => {
  assertProjectName(name);
  const result = spawnSync(path.join(scriptDir, 'bayalhost.mjs'), ['deploy', name], {
    cwd: repoDir,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    throw new Error(`${result.stdout}\n${result.stderr}`.trim() || `deploy failed: ${name}`);
  }

  return result.stdout.trim();
};

const readBody = async (request) => {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
};

const sendJson = (response, status, body) => {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(body));
};

const sendHtml = (response) => {
  response.writeHead(200, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(html);
};

const sendFile = (response, filePath) => {
  const contentType = contentTypes.get(path.extname(filePath)) ?? 'application/octet-stream';

  response.writeHead(200, {
    'content-type': contentType,
  });
  createReadStream(filePath).pipe(response);
};

const getProjectNameFromHost = (hostHeader) => {
  const hostname = (hostHeader ?? '').split(':')[0].toLowerCase();

  if (!hostname.endsWith('.bayalhost')) {
    return null;
  }

  return hostname.slice(0, -'.bayalhost'.length);
};

const getProjectRoot = (projectName) => {
  const config = readConfig();
  const project = config.projects.find(
    (currentProject) => currentProject.name === projectName && currentProject.enabled,
  );

  if (!project) {
    return null;
  }

  const deployedRoot = path.join(repoDir, 'sites', project.name, 'current');
  return existsSync(deployedRoot) ? deployedRoot : project.artifact;
};

const serveProject = (request, response, projectName, pathname) => {
  const projectRoot = getProjectRoot(projectName);

  if (!projectRoot) {
    sendJson(response, 404, { error: `project is not registered: ${projectName}` });
    return;
  }

  const rootPath = realpathOrSelf(projectRoot);
  const requestedPath = decodeURIComponent(pathname);
  const relativePath = requestedPath === '/' ? 'index.html' : requestedPath.replace(/^\/+/, '');
  const candidatePath = path.resolve(rootPath, relativePath);
  const indexPath = path.resolve(rootPath, 'index.html');

  if (candidatePath !== rootPath && !candidatePath.startsWith(`${rootPath}${path.sep}`)) {
    sendJson(response, 403, { error: 'forbidden' });
    return;
  }

  if (existsSync(candidatePath) && statSync(candidatePath).isFile()) {
    sendFile(response, candidatePath);
    return;
  }

  if (existsSync(indexPath)) {
    sendFile(response, indexPath);
    return;
  }

  sendJson(response, 404, { error: `index.html not found for ${projectName}` });
};

const handleApi = async (request, response, pathname) => {
  if (request.method === 'GET' && pathname === '/api/projects') {
    sendJson(response, 200, { projects: readConfig().projects });
    return;
  }

  if (request.method === 'GET' && pathname === '/api/scan') {
    sendJson(response, 200, { candidates: scanProjects() });
    return;
  }

  if (request.method === 'POST' && pathname === '/api/projects') {
    sendJson(response, 200, { project: addProject(await readBody(request)) });
    return;
  }

  if (request.method === 'POST' && pathname.startsWith('/api/deploy/')) {
    const name = decodeURIComponent(pathname.slice('/api/deploy/'.length));
    sendJson(response, 200, { output: deployProject(name) });
    return;
  }

  sendJson(response, 404, { error: 'not found' });
};

const handleAdminAsset = (response, pathname) => {
  const assetPath = path.resolve(repoDir, pathname.replace(/^\/+/, ''));
  const assetRoot = path.join(repoDir, 'assets');

  if (assetPath !== assetRoot && !assetPath.startsWith(`${assetRoot}${path.sep}`)) {
    sendJson(response, 403, { error: 'forbidden' });
    return;
  }

  if (!existsSync(assetPath) || !statSync(assetPath).isFile()) {
    sendJson(response, 404, { error: 'not found' });
    return;
  }

  sendFile(response, assetPath);
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'admin.bayalhost'}`);
    const projectName = getProjectNameFromHost(request.headers.host);

    if (projectName && projectName !== 'admin') {
      serveProject(request, response, projectName, url.pathname);
      return;
    }

    if (url.pathname.startsWith('/api/')) {
      await handleApi(request, response, url.pathname);
      return;
    }

    if (url.pathname.startsWith('/assets/')) {
      handleAdminAsset(response, url.pathname);
      return;
    }

    sendHtml(response);
  } catch (error) {
    sendJson(response, 500, { error: error.message });
  }
});

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>bayalhost admin</title>
  <link rel="icon" href="/assets/icon.png" type="image/png">
  <link rel="stylesheet" href="/assets/admin.css">
</head>
<body>
<main class="bh-shell">
  <div class="bh-header">
    <div class="bh-brand">
      <img class="bh-logo" src="/assets/icon.png" alt="">
      <h1 class="bh-title">bayalhost admin</h1>
    </div>
    <button class="bh-button" id="refresh">Refresh</button>
  </div>

  <section class="bh-section">
    <h2 class="bh-section-title">Registered Projects</h2>
    <div class="bh-table-wrap">
      <table class="bh-table">
        <thead><tr><th>Name</th><th>URL</th><th>Artifact</th><th>Status</th><th></th></tr></thead>
        <tbody id="projects"></tbody>
      </table>
    </div>
  </section>

  <section class="bh-section">
    <h2 class="bh-section-title">Add / Update</h2>
    <form class="bh-form" id="project-form">
      <label class="bh-field">Name<input class="bh-input" name="name" required pattern="[a-z0-9-]+"></label>
      <label class="bh-field">Artifact<input class="bh-input" name="artifact" required></label>
      <label class="bh-field">Source<input class="bh-input" name="source"></label>
      <label class="bh-field">Env file<input class="bh-input" name="envFile"></label>
      <button class="bh-button bh-button-primary">Save</button>
    </form>
  </section>

  <section class="bh-section">
    <h2 class="bh-section-title">Scan Candidates</h2>
    <div class="bh-table-wrap">
      <table class="bh-table">
        <thead><tr><th>Status</th><th>Name</th><th>Artifact</th><th></th></tr></thead>
        <tbody id="candidates"></tbody>
      </table>
    </div>
  </section>

  <div class="bh-message" id="message"></div>
</main>
<script>
const $ = (selector) => document.querySelector(selector);
const message = (text) => { $('#message').textContent = text; };
const requestJson = async (url, options) => {
  const response = await fetch(url, options);
  const body = await response.json();
  if (!response.ok || body.error) throw new Error(body.error || response.statusText);
  return body;
};
const fillForm = (project) => {
  const form = $('#project-form');
  form.name.value = project.name;
  form.artifact.value = project.artifact;
  form.source.value = project.source || '';
  form.envFile.value = project.envFile || '';
};
const projectUrl = (name) => {
  const hostParts = location.hostname.split('.');
  const domain = hostParts.slice(1).join('.') || 'bayalhost';
  return location.protocol + '//' + name + '.' + domain + (location.port ? ':' + location.port : '') + '/';
};
const deploy = async (name) => {
  const body = await requestJson('/api/deploy/' + encodeURIComponent(name), { method: 'POST' });
  message(body.output);
  await load();
};
const renderProjects = (projects) => {
  $('#projects').innerHTML = projects.map((project) => '<tr>' +
    '<td><strong>' + project.name + '</strong></td>' +
    '<td><a href="' + projectUrl(project.name) + '">' + projectUrl(project.name) + '</a></td>' +
    '<td class="bh-path">' + project.artifact + '</td>' +
    '<td><span class="bh-status">' + (project.enabled ? 'enabled' : 'disabled') + '</span></td>' +
    '<td><button class="bh-button" data-deploy="' + project.name + '">Deploy</button></td>' +
    '</tr>').join('');
};
const renderCandidates = (candidates) => {
  $('#candidates').innerHTML = candidates.map((candidate) => '<tr>' +
    '<td><span class="bh-status">' + candidate.status + '</span></td>' +
    '<td><strong>' + candidate.name + '</strong></td>' +
    '<td class="bh-path">' + candidate.artifact + '</td>' +
    '<td><button class="bh-button" data-add="' + encodeURIComponent(JSON.stringify(candidate)) + '">Use</button></td>' +
    '</tr>').join('');
};
const load = async () => {
  const [{ projects }, { candidates }] = await Promise.all([
    requestJson('/api/projects'),
    requestJson('/api/scan'),
  ]);
  renderProjects(projects);
  renderCandidates(candidates);
};
document.addEventListener('click', async (event) => {
  const deployName = event.target.dataset?.deploy;
  const addPayload = event.target.dataset?.add;
  try {
    if (deployName) await deploy(deployName);
    if (addPayload) fillForm(JSON.parse(decodeURIComponent(addPayload)));
  } catch (error) {
    message(error.message);
  }
});
$('#project-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target).entries());
  try {
    await requestJson('/api/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data),
    });
    message('Saved ' + data.name);
    await load();
  } catch (error) {
    message(error.message);
  }
});
$('#refresh').addEventListener('click', load);
load().catch((error) => message(error.message));
</script>
</body>
</html>`;

server.listen(port, '127.0.0.1', () => {
  console.log(`bayalhost admin listening on http://127.0.0.1:${port}`);
});
