const path = require('node:path');
const cacache = require(path.join(process.env.APPDATA, 'npm/node_modules/npm/node_modules/cacache'));
const source = path.join(process.env.LOCALAPPDATA, 'npm-cache/_cacache');
const target = path.resolve('.npm-cache/_cacache');
async function main() {
  const entries = await cacache.ls(source);
  const list = Object.values(entries);
  console.log(JSON.stringify({ entries: list.length, bytes: list.reduce((n, e) => n + e.size, 0) }));
  if (process.argv.includes('--copy')) {
    let count = 0;
    for (const entry of list) {
      // Seed metadata and normal JS packages; skip large platform SDKs and Electron.
      if ((entry.size > 8_000_000 && entry.key.endsWith('.tgz')) || /electron\/-|playwright|puppeteer/.test(entry.key)) continue;
      try {
        if (await cacache.get.info(target, entry.key)) continue;
        const { data } = await cacache.get(source, entry.key);
        await cacache.put(target, entry.key, data, { metadata: entry.metadata });
        count++;
      } catch (error) { console.warn(entry.key, error.message); }
    }
    console.log(`Prepared ${count} cached entries inside the workspace.`);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
