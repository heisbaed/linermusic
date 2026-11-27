import{y as ie,E as se,e as P,u as ae,n as ce,w as k,L as le,x as ue,z as de,l as K,A as z,B as he,i as H,C as O,r as fe}from"./index.esm-UffEpGYM.js";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const y=new Map,q={activated:!1,tokenObservers:[]},pe={initialized:!1,enabled:!1};function a(e){return y.get(e)||{...q}}function ge(e,t){return y.set(e,t),y.get(e)}function _(){return pe}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const I="https://content-firebaseappcheck.googleapis.com/v1",ke="exchangeRecaptchaV3Token",Te="exchangeRecaptchaEnterpriseToken",me="exchangeDebugToken",B={RETRIAL_MIN_WAIT:30*1e3,RETRIAL_MAX_WAIT:16*60*1e3},Ee=24*60*60*1e3;/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class we{constructor(t,r,n,o,i){if(this.operation=t,this.retryPolicy=r,this.getWaitDuration=n,this.lowerBound=o,this.upperBound=i,this.pending=null,this.nextErrorWaitInterval=o,o>i)throw new Error("Proactive refresh lower bound greater than upper bound!")}start(){this.nextErrorWaitInterval=this.lowerBound,this.process(!0).catch(()=>{})}stop(){this.pending&&(this.pending.reject("cancelled"),this.pending=null)}isRunning(){return!!this.pending}async process(t){this.stop();try{this.pending=new k,this.pending.promise.catch(r=>{}),await be(this.getNextRun(t)),this.pending.resolve(),await this.pending.promise,this.pending=new k,this.pending.promise.catch(r=>{}),await this.operation(),this.pending.resolve(),await this.pending.promise,this.process(!0).catch(()=>{})}catch(r){this.retryPolicy(r)?this.process(!1).catch(()=>{}):this.stop()}}getNextRun(t){if(t)return this.nextErrorWaitInterval=this.lowerBound,this.getWaitDuration();{const r=this.nextErrorWaitInterval;return this.nextErrorWaitInterval*=2,this.nextErrorWaitInterval>this.upperBound&&(this.nextErrorWaitInterval=this.upperBound),r}}}function be(e){return new Promise(t=>{setTimeout(t,e)})}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Ae={"already-initialized":"You have already called initializeAppCheck() for FirebaseApp {$appName} with different options. To avoid this error, call initializeAppCheck() with the same options as when it was originally called. This will return the already initialized instance.","use-before-activation":"App Check is being used before initializeAppCheck() is called for FirebaseApp {$appName}. Call initializeAppCheck() before instantiating other Firebase services.","fetch-network-error":"Fetch failed to connect to a network. Check Internet connection. Original error: {$originalErrorMessage}.","fetch-parse-error":"Fetch client could not parse response. Original error: {$originalErrorMessage}.","fetch-status-error":"Fetch server returned an HTTP error status. HTTP status: {$httpStatus}.","storage-open":"Error thrown when opening storage. Original error: {$originalErrorMessage}.","storage-get":"Error thrown when reading from storage. Original error: {$originalErrorMessage}.","storage-set":"Error thrown when writing to storage. Original error: {$originalErrorMessage}.","recaptcha-error":"ReCAPTCHA error.","initial-throttle":"{$httpStatus} error. Attempts allowed again after {$time}",throttled:"Requests throttled due to previous {$httpStatus} error. Attempts allowed again after {$time}"},u=new se("appCheck","AppCheck",Ae);/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function w(e=!1){return e?self.grecaptcha?.enterprise:self.grecaptcha}function D(e){if(!a(e).activated)throw u.create("use-before-activation",{appName:e.name})}function S(e){const t=Math.round(e/1e3),r=Math.floor(t/(3600*24)),n=Math.floor((t-r*3600*24)/3600),o=Math.floor((t-r*3600*24-n*3600)/60),i=t-r*3600*24-n*3600-o*60;let s="";return r&&(s+=m(r)+"d:"),n&&(s+=m(n)+"h:"),s+=m(o)+"m:"+m(i)+"s",s}function m(e){return e===0?"00":e>=10?e.toString():"0"+e}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function C({url:e,body:t},r){const n={"Content-Type":"application/json"},o=r.getImmediate({optional:!0});if(o){const p=await o.getHeartbeatsHeader();p&&(n["X-Firebase-Client"]=p)}const i={method:"POST",body:JSON.stringify(t),headers:n};let s;try{s=await fetch(e,i)}catch(p){throw u.create("fetch-network-error",{originalErrorMessage:p?.message})}if(s.status!==200)throw u.create("fetch-status-error",{httpStatus:s.status});let d;try{d=await s.json()}catch(p){throw u.create("fetch-parse-error",{originalErrorMessage:p?.message})}const l=d.ttl.match(/^([\d.]+)(s)$/);if(!l||!l[2]||isNaN(Number(l[1])))throw u.create("fetch-parse-error",{originalErrorMessage:`ttl field (timeToLive) is not in standard Protobuf Duration format: ${d.ttl}`});const c=Number(l[1])*1e3,f=Date.now();return{token:d.token,expireTimeMillis:f+c,issuedAtTimeMillis:f}}function _e(e,t){const{projectId:r,appId:n,apiKey:o}=e.options;return{url:`${I}/projects/${r}/apps/${n}:${ke}?key=${o}`,body:{recaptcha_v3_token:t}}}function Ce(e,t){const{projectId:r,appId:n,apiKey:o}=e.options;return{url:`${I}/projects/${r}/apps/${n}:${Te}?key=${o}`,body:{recaptcha_enterprise_token:t}}}function j(e,t){const{projectId:r,appId:n,apiKey:o}=e.options;return{url:`${I}/projects/${r}/apps/${n}:${me}?key=${o}`,body:{debug_token:t}}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Re="firebase-app-check-database",ve=1,T="firebase-app-check-store",U="debug-token";let E=null;function W(){return E||(E=new Promise((e,t)=>{try{const r=indexedDB.open(Re,ve);r.onsuccess=n=>{e(n.target.result)},r.onerror=n=>{t(u.create("storage-open",{originalErrorMessage:n.target.error?.message}))},r.onupgradeneeded=n=>{const o=n.target.result;switch(n.oldVersion){case 0:o.createObjectStore(T,{keyPath:"compositeKey"})}}}catch(r){t(u.create("storage-open",{originalErrorMessage:r?.message}))}}),E)}function ye(e){return X(V(e))}function Pe(e,t){return G(V(e),t)}function Ie(e){return G(U,e)}function De(){return X(U)}async function G(e,t){const n=(await W()).transaction(T,"readwrite"),i=n.objectStore(T).put({compositeKey:e,value:t});return new Promise((s,d)=>{i.onsuccess=l=>{s()},n.onerror=l=>{d(u.create("storage-set",{originalErrorMessage:l.target.error?.message}))}})}async function X(e){const r=(await W()).transaction(T,"readonly"),o=r.objectStore(T).get(e);return new Promise((i,s)=>{o.onsuccess=d=>{const l=d.target.result;i(l?l.value:void 0)},r.onerror=d=>{s(u.create("storage-get",{originalErrorMessage:d.target.error?.message}))}})}function V(e){return`${e.options.appId}-${e.name}`}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const h=new le("@firebase/app-check");/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Se(e){if(z()){let t;try{t=await ye(e)}catch(r){h.warn(`Failed to read token from IndexedDB. Error: ${r}`)}return t}}function R(e,t){return z()?Pe(e,t).catch(r=>{h.warn(`Failed to write token to IndexedDB. Error: ${r}`)}):Promise.resolve()}async function $e(e){let t;try{t=await De()}catch{}if(t)return t;{const r=crypto.randomUUID();let n=`To use this token for app debugging, register it with your project.

Firebase App Check debug token: ${r}

`;const o=e?.options.appId,i=e?.options.projectId;return i&&o?n+=`You can do so in the Firebase Console:
https://console.firebase.google.com/project/${i}/appcheck/apps?selectedAppId=${o}

Or using the Firebase CLI:
firebase appcheck:debugtokens:create ${r} --project ${i} --app ${o}

`:n+=`You will need to add it to your app's App Check settings in the Firebase Console for it to work.

`,n+=`Note: To keep your project secure, please revoke and delete this token using the
Firebase Console or the CLI (\`firebase appcheck:debugtokens:delete\`) when you finish debugging.

Warning: This debug token is a secret and should not be shared or uploaded to source code.

Debug Token Guide: https://firebase.google.com/docs/app-check/web/debug-provider
Firebase CLI install instructions: https://firebase.google.com/docs/cli
`,console.log(n),Ie(r).catch(s=>h.warn(`Failed to persist debug token to IndexedDB. Error: ${s}`)),r}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function $(){return _().enabled}async function x(){const e=_();if(e.enabled&&e.token)return e.token.promise;throw Error(`
            Can't get debug token in production mode.
        `)}function xe(e){const t=ue(),r=_();if(r.initialized=!0,typeof t.FIREBASE_APPCHECK_DEBUG_TOKEN!="string"&&t.FIREBASE_APPCHECK_DEBUG_TOKEN!==!0)return;r.enabled=!0;const n=new k;r.token=n,typeof t.FIREBASE_APPCHECK_DEBUG_TOKEN=="string"?n.resolve(t.FIREBASE_APPCHECK_DEBUG_TOKEN):n.resolve($e(e))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Me={error:"UNKNOWN_ERROR"};function Ne(e){return he.encodeString(JSON.stringify(e),!1)}async function b(e,t=!1,r=!1){const n=e.app;D(n);const o=a(n);let i=o.token,s;if(i&&!g(i)&&(o.token=void 0,i=void 0),!i){const c=await o.cachedTokenPromise;c&&(g(c)?i=c:await R(n,void 0))}if(!t&&i&&g(i))return{token:i.token};let d=!1;if($())try{const c=await x();o.exchangeTokenPromise||(o.exchangeTokenPromise=C(j(n,c),e.heartbeatServiceProvider).finally(()=>{o.exchangeTokenPromise=void 0}),d=!0);const f=await o.exchangeTokenPromise;return await R(n,f),o.token=f,{token:f.token}}catch(c){return c.code==="appCheck/throttled"||c.code==="appCheck/initial-throttle"?h.warn(c.message):r&&h.error(c),v(c)}try{o.exchangeTokenPromise||(o.exchangeTokenPromise=o.provider.getToken().finally(()=>{o.exchangeTokenPromise=void 0}),d=!0),i=await a(n).exchangeTokenPromise}catch(c){c.code==="appCheck/throttled"||c.code==="appCheck/initial-throttle"?h.warn(c.message):r&&h.error(c),s=c}let l;return i?s?g(i)?l={token:i.token,internalError:s}:l=v(s):(l={token:i.token},o.token=i,await R(n,i)):l=v(s),d&&J(n,l),l}async function Y(e){const t=e.app;D(t);const{provider:r}=a(t);if($()){const n=await x(),o=j(t,n);o.body.limited_use=!0;const{token:i}=await C(o,e.heartbeatServiceProvider);return{token:i}}else{const{token:n}=await r.getToken(!0);return{token:n}}}function M(e,t,r,n){const{app:o}=e,i=a(o),s={next:r,error:n,type:t};if(i.tokenObservers=[...i.tokenObservers,s],i.token&&g(i.token)){const d=i.token;Promise.resolve().then(()=>{r({token:d.token}),F(e)}).catch(()=>{})}i.cachedTokenPromise.then(()=>F(e))}function N(e,t){const r=a(e),n=r.tokenObservers.filter(o=>o.next!==t);n.length===0&&r.tokenRefresher&&r.tokenRefresher.isRunning()&&r.tokenRefresher.stop(),r.tokenObservers=n}function F(e){const{app:t}=e,r=a(t);let n=r.tokenRefresher;n||(n=He(e),r.tokenRefresher=n),!n.isRunning()&&r.isTokenAutoRefreshEnabled&&n.start()}function He(e){const{app:t}=e;return new we(async()=>{const r=a(t);let n;if(r.token?n=await b(e,!0):n=await b(e),n.error)throw n.error;if(n.internalError)throw n.internalError},()=>!0,()=>{const r=a(t);if(r.token){let n=r.token.issuedAtTimeMillis+(r.token.expireTimeMillis-r.token.issuedAtTimeMillis)*.5+3e5;const o=r.token.expireTimeMillis-5*60*1e3;return n=Math.min(n,o),Math.max(0,n-Date.now())}else return 0},B.RETRIAL_MIN_WAIT,B.RETRIAL_MAX_WAIT)}function J(e,t){const r=a(e).tokenObservers;for(const n of r)try{n.type==="EXTERNAL"&&t.error!=null?n.error(t.error):n.next(t)}catch{}}function g(e){return e.expireTimeMillis-Date.now()>0}function v(e){return{token:Ne(Me),error:e}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Oe{constructor(t,r){this.app=t,this.heartbeatServiceProvider=r}_delete(){const{tokenObservers:t}=a(this.app);for(const r of t)N(this.app,r.next);return Promise.resolve()}}function Be(e,t){return new Oe(e,t)}function Fe(e){return{getToken:t=>b(e,t),getLimitedUseToken:()=>Y(e),addTokenListener:t=>M(e,"INTERNAL",t),removeTokenListener:t=>N(e.app,t)}}const Le="@firebase/app-check",Ke="0.13.2";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ze="https://www.google.com/recaptcha/api.js",qe="https://www.google.com/recaptcha/enterprise.js";function je(e,t){const r=new k,n=a(e);n.reCAPTCHAState={initialized:r};const o=Q(e),i=w(!1);return i?A(e,t,i,o,r):Ge(()=>{const s=w(!1);if(!s)throw new Error("no recaptcha");A(e,t,s,o,r)}),r.promise}function Ue(e,t){const r=new k,n=a(e);n.reCAPTCHAState={initialized:r};const o=Q(e),i=w(!0);return i?A(e,t,i,o,r):Xe(()=>{const s=w(!0);if(!s)throw new Error("no recaptcha");A(e,t,s,o,r)}),r.promise}function A(e,t,r,n,o){r.ready(()=>{We(e,t,r,n),o.resolve(r)})}function Q(e){const t=`fire_app_check_${e.name}`,r=document.createElement("div");return r.id=t,r.style.display="none",document.body.appendChild(r),t}async function Z(e){D(e);const r=await a(e).reCAPTCHAState.initialized.promise;return new Promise((n,o)=>{const i=a(e).reCAPTCHAState;r.ready(()=>{n(r.execute(i.widgetId,{action:"fire_app_check"}))})})}function We(e,t,r,n){const o=r.render(n,{sitekey:t,size:"invisible",callback:()=>{a(e).reCAPTCHAState.succeeded=!0},"error-callback":()=>{a(e).reCAPTCHAState.succeeded=!1}}),i=a(e);i.reCAPTCHAState={...i.reCAPTCHAState,widgetId:o}}function Ge(e){const t=document.createElement("script");K(t,ze),t.onload=e,document.head.appendChild(t)}function Xe(e){const t=document.createElement("script");K(t,qe+"?render=explicit"),t.onload=e,document.head.appendChild(t)}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ee{constructor(t){this._siteKey=t,this._throttleData=null}async getToken(t=!1){oe(this._throttleData);const r=await Z(this._app).catch(o=>{throw u.create("recaptcha-error")});if(!a(this._app).reCAPTCHAState?.succeeded)throw u.create("recaptcha-error");let n;try{const o=_e(this._app,r);t&&(o.body.limited_use=!0),n=await C(o,this._heartbeatServiceProvider)}catch(o){throw o.code?.includes("fetch-status-error")?(this._throttleData=ne(Number(o.customData?.httpStatus),this._throttleData),u.create("initial-throttle",{time:S(this._throttleData.allowRequestsAfter-Date.now()),httpStatus:this._throttleData.httpStatus})):o}return this._throttleData=null,n}initialize(t){this._app=t,this._heartbeatServiceProvider=P(t,"heartbeat"),je(t,this._siteKey).catch(()=>{})}isEqual(t){return t instanceof ee?this._siteKey===t._siteKey:!1}}class te{constructor(t){this._siteKey=t,this._throttleData=null}async getToken(t=!1){oe(this._throttleData);const r=await Z(this._app).catch(o=>{throw u.create("recaptcha-error")});if(!a(this._app).reCAPTCHAState?.succeeded)throw u.create("recaptcha-error");let n;try{const o=Ce(this._app,r);t&&(o.body.limited_use=!0),n=await C(o,this._heartbeatServiceProvider)}catch(o){throw o.code?.includes("fetch-status-error")?(this._throttleData=ne(Number(o.customData?.httpStatus),this._throttleData),u.create("initial-throttle",{time:S(this._throttleData.allowRequestsAfter-Date.now()),httpStatus:this._throttleData.httpStatus})):o}return this._throttleData=null,n}initialize(t){this._app=t,this._heartbeatServiceProvider=P(t,"heartbeat"),Ue(t,this._siteKey).catch(()=>{})}isEqual(t){return t instanceof te?this._siteKey===t._siteKey:!1}}class re{constructor(t){this._customProviderOptions=t}async getToken(){const t=await this._customProviderOptions.getToken(),r=ie(t.token),n=r!==null&&r<Date.now()&&r>0?r*1e3:Date.now();return{...t,issuedAtTimeMillis:n}}initialize(t){this._app=t}isEqual(t){return t instanceof re?this._customProviderOptions.getToken.toString()===t._customProviderOptions.getToken.toString():!1}}function ne(e,t){if(e===404||e===403)return{backoffCount:1,allowRequestsAfter:Date.now()+Ee,httpStatus:e};{const r=t?t.backoffCount:0,n=de(r,1e3,2);return{backoffCount:r+1,allowRequestsAfter:Date.now()+n,httpStatus:e}}}function oe(e){if(e&&Date.now()-e.allowRequestsAfter<=0)throw u.create("throttled",{time:S(e.allowRequestsAfter-Date.now()),httpStatus:e.httpStatus})}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Ze(e=ce(),t){e=ae(e);const r=P(e,"app-check");if(_().initialized||xe(e),$()&&x().then(o=>{console.log(`Firebase App Check debug token: ${o}`)}),r.isInitialized()){const o=r.getImmediate(),i=r.getOptions();if(i&&!!i.isTokenAutoRefreshEnabled==!!t.isTokenAutoRefreshEnabled&&i.provider?.isEqual(t.provider))return o;throw u.create("already-initialized",{appName:e.name})}const n=r.initialize({options:t});return Ve(e,t.provider,t.isTokenAutoRefreshEnabled),a(e).isTokenAutoRefreshEnabled&&M(n,"INTERNAL",()=>{}),n}function Ve(e,t,r=!1){const n=ge(e,{...q});n.activated=!0,n.provider=t,n.cachedTokenPromise=Se(e).then(o=>(o&&g(o)&&(n.token=o,J(e,{token:o.token})),o)),n.isTokenAutoRefreshEnabled=r&&e.automaticDataCollectionEnabled,!e.automaticDataCollectionEnabled&&r&&h.warn("`isTokenAutoRefreshEnabled` is true but `automaticDataCollectionEnabled` was set to false during `initializeApp()`. This blocks automatic token refresh."),n.provider.initialize(e)}function et(e,t){const r=e.app,n=a(r);n.tokenRefresher&&(t===!0?n.tokenRefresher.start():n.tokenRefresher.stop()),n.isTokenAutoRefreshEnabled=t}async function tt(e,t){const r=await b(e,t);if(r.error)throw r.error;if(r.internalError)throw r.internalError;return{token:r.token}}function rt(e){return Y(e)}function nt(e,t,r,n){let o=()=>{},i=()=>{};return t.next!=null?o=t.next.bind(t):o=t,t.error!=null?i=t.error.bind(t):r&&(i=r),M(e,"EXTERNAL",o,i),()=>N(e.app,o)}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Ye="app-check",L="app-check-internal";function Je(){H(new O(Ye,e=>{const t=e.getProvider("app").getImmediate(),r=e.getProvider("heartbeat");return Be(t,r)},"PUBLIC").setInstantiationMode("EXPLICIT").setInstanceCreatedCallback((e,t,r)=>{e.getProvider(L).initialize()})),H(new O(L,e=>{const t=e.getProvider("app-check").getImmediate();return Fe(t)},"PUBLIC").setInstantiationMode("EXPLICIT")),fe(Le,Ke)}Je();export{re as CustomProvider,te as ReCaptchaEnterpriseProvider,ee as ReCaptchaV3Provider,rt as getLimitedUseToken,tt as getToken,Ze as initializeAppCheck,nt as onTokenChanged,et as setTokenAutoRefreshEnabled};
