// sites/<name>/current は Caddy と admin-server が共通で読む唯一の配信入口。
// 「何を配信するか」の判断はここ (config → sites/ の同期) だけで行い、配信側には分岐を持たせない。
// 以前は live の分岐が admin-server にしか無く、Caddy 経由の *.bayalhost では効いていなかった。
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readlinkSync,
  realpathSync,
  renameSync,
  statSync,
  symlinkSync,
  unlinkSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoDir = path.resolve(scriptDir, '..');
const sitesDir = path.join(repoDir, 'sites');

// rsync -a がコピー先に保つ mtime は秒精度で、ms 比較だと同じ版でも artifact 側が新しく見える
const MTIME_RESOLUTION_MS = 1000;

export const currentPath = (name) => path.join(sitesDir, name, 'current');

const readLinkOrNull = (linkPath) => {
  try {
    return lstatSync(linkPath).isSymbolicLink() ? readlinkSync(linkPath) : null;
  } catch {
    return null;
  }
};

const indexMtime = (dir) => {
  try {
    return statSync(path.join(dir, 'index.html')).mtimeMs;
  } catch {
    return null;
  }
};

// tmp に張ってから rename するのは、差し替え中に current が消える瞬間を作らないため
const linkCurrent = (name, target) => {
  const linkPath = currentPath(name);
  const tmpPath = `${linkPath}.tmp-${process.pid}`;
  mkdirSync(path.dirname(linkPath), { recursive: true });
  symlinkSync(target, tmpPath);
  renameSync(tmpPath, linkPath);
};

export const runDeploy = (project) => {
  const args = [project.name, project.artifact, ...(project.envFile ? [project.envFile] : [])];
  const result = spawnSync(path.join(scriptDir, 'deploy-dist.sh'), args, { encoding: 'utf8' });

  if (result.status !== 0) {
    throw new Error(`${result.stdout}\n${result.stderr}`.trim() || `deploy failed: ${project.name}`);
  }

  return result.stdout.trim();
};

const isRelease = (link) => link !== null && link.startsWith('releases/');

// project 1 件の sites/ を config に合わせる。何をしたかを 1 行で返す (何もしなければ null)
export const syncProject = (project) => {
  const link = readLinkOrNull(currentPath(project.name));

  if (!project.enabled) {
    if (link === null) {
      return null;
    }
    unlinkSync(currentPath(project.name));
    return `${project.name}: disabled, unlinked current`;
  }

  if (project.live) {
    if (link === project.artifact) {
      return null;
    }
    if (project.envFile) {
      console.warn(`${project.name}: live ignores envFile (env.js is rendered only on deploy)`);
    }
    linkCurrent(project.name, project.artifact);
    return `${project.name}: live, current -> ${project.artifact}`;
  }

  // live でない project は deploy スナップショットを配る。手で artifact に張られた symlink や
  // current 欠落は「deploy されたつもりで実は違う」状態なので、ここで deploy し直して揃える
  if (isRelease(link)) {
    return null;
  }
  runDeploy(project);
  return `${project.name}: deployed (current was ${link ?? 'missing'})`;
};

export const syncSites = (projects) =>
  projects.flatMap((project) => {
    try {
      const change = syncProject(project);
      return change ? [change] : [];
    } catch (error) {
      console.error(`sync failed: ${project.name}`, error);
      return [`${project.name}: sync failed: ${error.message}`];
    }
  });

// 配信中の index.html が artifact より古ければ stale。deploy-dist.sh は rsync -a で
// mtime を保つので、release 側の mtime は「deploy した時点の artifact の mtime」になる
export const siteStatus = (project) => {
  const link = readLinkOrNull(currentPath(project.name));
  const servedMtime = link === null ? null : indexMtime(currentPath(project.name));
  const artifactMtime = indexMtime(project.artifact);
  const isServingArtifact = link !== null
    && existsSync(project.artifact)
    && realpathSync(currentPath(project.name)) === realpathSync(project.artifact);

  return {
    mode: project.live ? 'live' : 'release',
    current: link,
    servedMtime,
    artifactMtime,
    isMissing: servedMtime === null,
    isInSync: project.enabled ? (project.live ? isServingArtifact : isRelease(link)) : link === null,
    isStale: servedMtime !== null && artifactMtime !== null
      && Math.floor(artifactMtime / MTIME_RESOLUTION_MS) > Math.floor(servedMtime / MTIME_RESOLUTION_MS),
  };
};
