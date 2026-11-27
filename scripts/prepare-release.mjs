import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const version=JSON.parse(await fs.readFile('mobile/package.json','utf8')).version;
const versionCode=Number((await fs.readFile('android/app/build.gradle','utf8')).match(/getOrElse\((\d+)\)/)?.[1]);
const manifests={}, sums=[];
for(const platform of ['mobile','tv']){
 const name=`Cine-Music-${platform==='tv'?'TV':'Mobile'}-${version}.apk`;
 const apk=await fs.readFile('releases/'+name), sha256=crypto.createHash('sha256').update(apk).digest('hex');
 const manifest={version,versionCode,platform,downloadUrl:`https://github.com/heisbaed/linermusic/releases/download/v${version}/${name}`,fileSize:apk.length,sha256,releaseNotes:'Encrypted offline playback uses the streaming audio engine. Adds Liked Songs sorting and genre/type filters, four selectable launcher icons, and update progress with an Install button directly on the update screen. Includes stricter download completion checks.'};
 manifests[platform]=manifest;sums.push(`${sha256}  ${name}`);
 await fs.writeFile(`landing page web/public/ota/${platform==='tv'?'tv-manifest.json':'manifest.json'}`,JSON.stringify(manifest,null,2)+'\n');
}
await fs.writeFile('releases/SHA256SUMS.txt',sums.join('\n')+'\n');
const file='landing page web/src/App.tsx';let source=await fs.readFile(file,'utf8');
source=source.replace(/0\.1\.\d+/g,version).replace(/const APK_URL =\s*"[^"]*";/,`const APK_URL = "${manifests.mobile.downloadUrl}";`).replace(/const APK_SHA256 = "[^"]*";/,`const APK_SHA256 = "${manifests.mobile.sha256}";`).replace(/const APK_TV_URL = "[^"]*";/,`const APK_TV_URL = "${manifests.tv.downloadUrl}";`).replace(/const APK_TV_SHA256 = "[^"]*";/,`const APK_TV_SHA256 = "${manifests.tv.sha256}";`).replace(/\d+\.\d+ MB/g,(manifests.mobile.fileSize/1e6).toFixed(2)+' MB').replace(/const APK_TV_SIZE = "[^"]*";/,`const APK_TV_SIZE = "${(manifests.tv.fileSize/1e6).toFixed(2)} MB";`);
await fs.writeFile(file,source);console.log(JSON.stringify(manifests));
