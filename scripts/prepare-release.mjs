import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const apk = await fs.readFile('releases/Cine-Music-0.1.2.apk');
const sha256 = crypto.createHash('sha256').update(apk).digest('hex');
const manifest = { version:'0.1.2', versionCode:3, downloadUrl:'https://github.com/heisbaed/linermusic/releases/download/v0.1.2/Cine-Music-0.1.2.apk', fileSize:apk.length, sha256,
 releaseNotes:'Restored lyrics follow scrolling and controls, fixed search visibility, repaired persistent download queues and audio focus, and added verified in-app APK updates.' };
await fs.writeFile('landing page web/public/ota/manifest.json', JSON.stringify(manifest,null,2)+'\n');
await fs.writeFile('releases/SHA256SUMS.txt',sha256+'  Cine-Music-0.1.2.apk\n');
const file='landing page web/src/App.tsx';
let source=await fs.readFile(file,'utf8');
source=source.replaceAll('0.1.1','0.1.2').replaceAll('V0.1.1','V0.1.2').replace(/const APK_SHA256 = "[a-f0-9]+";/,`const APK_SHA256 = "${sha256}";`).replaceAll('12.43 MB',(apk.length/1000000).toFixed(2)+' MB');
await fs.writeFile(file,source);
console.log(JSON.stringify({version:manifest.version,bytes:apk.length,sha256}));
