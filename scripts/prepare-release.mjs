import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const version = JSON.parse(await fs.readFile('mobile/package.json','utf8')).version;
const apk = await fs.readFile(`releases/Cine-Music-${version}.apk`);
const sha256 = crypto.createHash('sha256').update(apk).digest('hex');
const versionCode = Number((await fs.readFile('android/app/build.gradle','utf8')).match(/getOrElse\((\d+)\)/)?.[1]);
if (!versionCode) throw new Error('Android version code is missing');
const manifest = { version, versionCode, downloadUrl:`https://github.com/heisbaed/linermusic/releases/download/v${version}/Cine-Music-${version}.apk`, fileSize:apk.length, sha256,
 releaseNotes:'Live search suggestions, progressive results and better partial-name matching; Resume all for paused/failed downloads; includes earlier lyrics, playback and search-field repairs.' };
await fs.writeFile('landing page web/public/ota/manifest.json', JSON.stringify(manifest,null,2)+'\n');
await fs.writeFile('releases/SHA256SUMS.txt',sha256+`  Cine-Music-${version}.apk\n`);
const file='landing page web/src/App.tsx';
let source=await fs.readFile(file,'utf8');
source=source.replace(/0\.1\.\d+/g,version).replace(/const APK_SHA256 = "[a-f0-9]+";/,`const APK_SHA256 = "${sha256}";`).replace(/\d+\.\d+ MB/g,(apk.length/1000000).toFixed(2)+' MB');
await fs.writeFile(file,source);
console.log(JSON.stringify({version:manifest.version,bytes:apk.length,sha256}));
