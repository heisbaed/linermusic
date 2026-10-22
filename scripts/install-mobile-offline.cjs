// Uses already cached npm tarballs without contacting the registry.
const fs = require('node:fs/promises');
const path = require('node:path');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const npmModules = path.join(process.env.APPDATA, 'npm/node_modules/npm/node_modules');
const cacache = require(path.join(npmModules, 'cacache'));
const semver = require(path.join(npmModules, 'semver'));
const tar = require(path.join(npmModules, 'tar'));
const cache = path.resolve('.npm-cache/_cacache');
const root = path.resolve('mobile');
const candidates = new Map();
const installed = new Map();
const isOptionalPlatform = name => name.startsWith('@esbuild/') || name.startsWith('@rollup/rollup-') || name === 'fsevents';
async function install(name, requested, parent = root) {
  if (isOptionalPlatform(name) && !/win32-x64(?:-msvc)?$/.test(name)) return;
  const range = requested.startsWith('https:') ? /-([\d][^/]*)\.tgz$/.exec(requested)?.[1] : requested;
  let destination = path.join(root, 'node_modules', name);
  if (installed.has(destination)) {
    if (semver.satisfies(installed.get(destination), range)) return;
    destination = path.join(parent, 'node_modules', name);
    if (installed.has(destination)) return;
  }
  const choices = candidates.get(name) || [];
  const choice = choices.filter(item => semver.satisfies(item.version, range)).sort((a, b) => semver.rcompare(a.version, b.version))[0];
  if (!choice) throw new Error(`Missing cached package: ${name}@${range}`);
  const { data } = await cacache.get(cache, choice.key);
  await fs.mkdir(destination, { recursive: true });
  await pipeline(Readable.from(data), tar.x({ cwd: destination, strip: 1 }));
  const manifest = JSON.parse(await fs.readFile(path.join(destination, 'package.json'), 'utf8'));
  installed.set(destination, manifest.version);
  for (const [dependency, spec] of Object.entries(manifest.dependencies || {})) await install(dependency, spec, destination);
  for (const [dependency, spec] of Object.entries(manifest.optionalDependencies || {})) {
    if (isOptionalPlatform(dependency)) await install(dependency, spec, destination);
  }
  if (manifest.bin) {
    const bins = typeof manifest.bin === 'string' ? { [name.split('/').pop()]: manifest.bin } : manifest.bin;
    const binDir = path.join(root, 'node_modules/.bin'); await fs.mkdir(binDir, { recursive: true });
    for (const [bin, relative] of Object.entries(bins)) {
      const target = path.relative(binDir, path.join(destination, relative));
      await fs.writeFile(path.join(binDir, `${bin}.cmd`), `@echo off\r\nnode "%~dp0${target}" %*\r\n`);
    }
  }
}
async function main() {
  const entries = Object.values(await cacache.ls(cache));
  for (const entry of entries) {
    const match = /registry\.npmjs\.org\/((?:@[^/]+\/)?[^/]+)\/-\/[^/]+-([0-9][^/]*)\.tgz$/.exec(entry.key);
    if (!match || !semver.valid(match[2])) continue;
    if (!candidates.has(match[1])) candidates.set(match[1], []);
    candidates.get(match[1]).push({ key: entry.key, version: match[2] });
  }
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
  for (const [name, spec] of Object.entries({ ...manifest.dependencies, ...manifest.devDependencies })) await install(name, spec);
  console.log(`Installed ${installed.size} cached packages for the mobile build.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
