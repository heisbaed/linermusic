import{F as Ae,L as Ce,u as Ie,e as we,n as Ne,g as be,v as y,w as Le,i as Pe,C as De,r as q,x as Me}from"./index.esm-UffEpGYM.js";var J="@firebase/ai",V="3.1.0";/**
 * @license
 * Copyright 2024 Google LLC
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
 */const L="AI",ve="global",se="firebasevertexai.googleapis.com",k="v1beta",K=V,ke="gl-js",Ue="hybrid",xe=180*1e3,Ge="gemini-3.5-flash-lite";/**
 * @license
 * Copyright 2024 Google LLC
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
 */class c extends Ae{constructor(e,t,s){const o=L,a=`${o}/${e}`,i=`${o}: ${t} (${a})`;super(e,i),this.code=e,this.customErrorData=s,Error.captureStackTrace&&Error.captureStackTrace(this,c),Object.setPrototypeOf(this,c.prototype),this.toString=()=>i}}/**
 * @license
 * Copyright 2024 Google LLC
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
 */const Q=["user","model","function","system"],xt={HARM_CATEGORY_HATE_SPEECH:"HARM_CATEGORY_HATE_SPEECH",HARM_CATEGORY_SEXUALLY_EXPLICIT:"HARM_CATEGORY_SEXUALLY_EXPLICIT",HARM_CATEGORY_HARASSMENT:"HARM_CATEGORY_HARASSMENT",HARM_CATEGORY_DANGEROUS_CONTENT:"HARM_CATEGORY_DANGEROUS_CONTENT"},Gt={BLOCK_LOW_AND_ABOVE:"BLOCK_LOW_AND_ABOVE",BLOCK_MEDIUM_AND_ABOVE:"BLOCK_MEDIUM_AND_ABOVE",BLOCK_ONLY_HIGH:"BLOCK_ONLY_HIGH",BLOCK_NONE:"BLOCK_NONE",OFF:"OFF"},Ft={SEVERITY:"SEVERITY",PROBABILITY:"PROBABILITY"},Ht={NEGLIGIBLE:"NEGLIGIBLE",LOW:"LOW",MEDIUM:"MEDIUM",HIGH:"HIGH"},oe={HARM_SEVERITY_NEGLIGIBLE:"HARM_SEVERITY_NEGLIGIBLE",HARM_SEVERITY_LOW:"HARM_SEVERITY_LOW",HARM_SEVERITY_MEDIUM:"HARM_SEVERITY_MEDIUM",HARM_SEVERITY_HIGH:"HARM_SEVERITY_HIGH",HARM_SEVERITY_UNSUPPORTED:"HARM_SEVERITY_UNSUPPORTED"},$t={SAFETY:"SAFETY",OTHER:"OTHER",BLOCKLIST:"BLOCKLIST",PROHIBITED_CONTENT:"PROHIBITED_CONTENT"},m={STOP:"STOP",MAX_TOKENS:"MAX_TOKENS",SAFETY:"SAFETY",RECITATION:"RECITATION",OTHER:"OTHER",BLOCKLIST:"BLOCKLIST",PROHIBITED_CONTENT:"PROHIBITED_CONTENT",SPII:"SPII",MALFORMED_FUNCTION_CALL:"MALFORMED_FUNCTION_CALL",IMAGE_SAFETY:"IMAGE_SAFETY",IMAGE_PROHIBITED_CONTENT:"IMAGE_PROHIBITED_CONTENT",IMAGE_OTHER:"IMAGE_OTHER",NO_IMAGE:"NO_IMAGE",IMAGE_RECITATION:"IMAGE_RECITATION",LANGUAGE:"LANGUAGE",UNEXPECTED_TOOL_CALL:"UNEXPECTED_TOOL_CALL",TOO_MANY_TOOL_CALLS:"TOO_MANY_TOOL_CALLS",MISSING_THOUGHT_SIGNATURE:"MISSING_THOUGHT_SIGNATURE",MALFORMED_RESPONSE:"MALFORMED_RESPONSE"},Vt={SQUARE_1x1:"1:1",PORTRAIT_9x16:"9:16",LANDSCAPE_16x9:"16:9",PORTRAIT_3x4:"3:4",LANDSCAPE_4x3:"4:3",PORTRAIT_2x3:"2:3",LANDSCAPE_3x2:"3:2",PORTRAIT_4x5:"4:5",LANDSCAPE_5x4:"5:4",PORTRAIT_1x4:"1:4",LANDSCAPE_4x1:"4:1",PORTRAIT_1x8:"1:8",LANDSCAPE_8x1:"8:1",ULTRAWIDE_21x9:"21:9"},Bt={SIZE_512:"512",SIZE_1K:"1K",SIZE_2K:"2K",SIZE_4K:"4K"},Yt={AUTO:"AUTO",ANY:"ANY",NONE:"NONE"},Wt={MODALITY_UNSPECIFIED:"MODALITY_UNSPECIFIED",TEXT:"TEXT",IMAGE:"IMAGE",VIDEO:"VIDEO",AUDIO:"AUDIO",DOCUMENT:"DOCUMENT"},jt={TEXT:"TEXT",IMAGE:"IMAGE",AUDIO:"AUDIO"},R={PREFER_ON_DEVICE:"prefer_on_device",ONLY_ON_DEVICE:"only_on_device",ONLY_IN_CLOUD:"only_in_cloud",PREFER_IN_CLOUD:"prefer_in_cloud"},T={ON_DEVICE:"on_device",IN_CLOUD:"in_cloud"},qt={UNSPECIFIED:"OUTCOME_UNSPECIFIED",OK:"OUTCOME_OK",FAILED:"OUTCOME_FAILED",DEADLINE_EXCEEDED:"OUTCOME_DEADLINE_EXCEEDED"},Jt={UNSPECIFIED:"LANGUAGE_UNSPECIFIED",PYTHON:"PYTHON"},Kt={MINIMAL:"MINIMAL",LOW:"LOW",MEDIUM:"MEDIUM",HIGH:"HIGH"};/**
 * @license
 * Copyright 2024 Google LLC
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
 */const Qt={URL_RETRIEVAL_STATUS_UNSPECIFIED:"URL_RETRIEVAL_STATUS_UNSPECIFIED",URL_RETRIEVAL_STATUS_SUCCESS:"URL_RETRIEVAL_STATUS_SUCCESS",URL_RETRIEVAL_STATUS_ERROR:"URL_RETRIEVAL_STATUS_ERROR",URL_RETRIEVAL_STATUS_PAYWALL:"URL_RETRIEVAL_STATUS_PAYWALL",URL_RETRIEVAL_STATUS_UNSAFE:"URL_RETRIEVAL_STATUS_UNSAFE"},w={SERVER_CONTENT:"serverContent",TOOL_CALL:"toolCall",TOOL_CALL_CANCELLATION:"toolCallCancellation",GOING_AWAY_NOTICE:"goingAwayNotice",SESSION_RESUMPTION_UPDATE:"sessionResumptionUpdate"};/**
 * @license
 * Copyright 2024 Google LLC
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
 */const l={ERROR:"error",REQUEST_ERROR:"request-error",RESPONSE_ERROR:"response-error",FETCH_ERROR:"fetch-error",SESSION_CLOSED:"session-closed",INVALID_CONTENT:"invalid-content",API_NOT_ENABLED:"api-not-enabled",ALREADY_INITIALIZED:"already-initialized",INVALID_SCHEMA:"invalid-schema",NO_API_KEY:"no-api-key",NO_APP_ID:"no-app-id",NO_MODEL:"no-model",NO_PROJECT_ID:"no-project-id",PARSE_FAILED:"parse-failed",UNSUPPORTED:"unsupported"};/**
 * @license
 * Copyright 2024 Google LLC
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
 */const C={STRING:"string",NUMBER:"number",INTEGER:"integer",BOOLEAN:"boolean",ARRAY:"array",OBJECT:"object"};/**
 * @license
 * Copyright 2024 Google LLC
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
 */const _={AGENT_PLATFORM:"AGENT_PLATFORM",GOOGLE_AI:"GOOGLE_AI"};/**
 * @license
 * Copyright 2025 Google LLC
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
 */class ie{constructor(e){this.backendType=e}}class B extends ie{constructor(){super(_.GOOGLE_AI)}_getModelPath(e,t){return`/${k}/projects/${e}/${t}`}_getTemplatePath(e,t){return`/${k}/projects/${e}/templates/${t}`}}class U extends ie{constructor(e){super(_.AGENT_PLATFORM),this.location=ve,e&&(this.location=e)}_getModelPath(e,t){return`/${k}/projects/${e}/locations/${this.location}/${t}`}_getTemplatePath(e,t){return`/${k}/projects/${e}/locations/${this.location}/templates/${t}`}}/**
 * @license
 * Copyright 2025 Google LLC
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
 */function Fe(n){if(n instanceof B)return`${L}/googleai`;if(n instanceof U)return`${L}/agentplatform/${n.location}`;throw new c(l.ERROR,`Invalid backend: ${JSON.stringify(n.backendType)}`)}function He(n){const e=n.split("/");if(e[0]!==L)throw new c(l.ERROR,`Invalid instance identifier, unknown prefix '${e[0]}'`);switch(e[1]){case"agentplatform":const s=e[2];if(!s)throw new c(l.ERROR,`Invalid instance identifier, unknown location '${n}'`);return new U(s);case"googleai":return new B;default:throw new c(l.ERROR,`Invalid instance identifier string: '${n}'`)}}/**
 * @license
 * Copyright 2024 Google LLC
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
 */const h=new Ce("@firebase/ai");var O;(function(n){n.UNAVAILABLE="unavailable",n.DOWNLOADABLE="downloadable",n.DOWNLOADING="downloading",n.AVAILABLE="available"})(O||(O={}));/**
 * @license
 * Copyright 2025 Google LLC
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
 */const ae={type:"text",languages:["en"]},G=[ae,{type:"image"}],F=[ae];class g{constructor(e,t,s){this.languageModelProvider=e,this.mode=t,this.downloadPromise=null,this.onDeviceParams={createOptions:{expectedInputs:G,expectedOutputs:F}},s&&(this.onDeviceParams=s,this.onDeviceParams.createOptions?(this.onDeviceParams.createOptions.expectedInputs||(this.onDeviceParams.createOptions.expectedInputs=G),this.onDeviceParams.createOptions.expectedOutputs||(this.onDeviceParams.createOptions.expectedOutputs=F)):this.onDeviceParams.createOptions={expectedInputs:G,expectedOutputs:F})}async isAvailable(e){if(!this.mode)return h.debug("On-device inference unavailable because mode is undefined."),!1;if(this.mode===R.ONLY_IN_CLOUD)return h.debug('On-device inference unavailable because mode is "only_in_cloud".'),!1;const t=await this.languageModelProvider?.availability(this.onDeviceParams.createOptions);if(this.mode===R.ONLY_ON_DEVICE){if(t===O.UNAVAILABLE)throw new c(l.API_NOT_ENABLED,"Local LanguageModel API not available in this environment.");if(t===O.DOWNLOADABLE||t===O.DOWNLOADING){h.debug("Waiting for download of LanguageModel to complete.");try{await this.downloadPromise}catch(s){throw new c(l.ERROR,s.message)}return!0}return!0}return t!==O.AVAILABLE?(h.debug(`On-device inference unavailable because availability is "${t}".`),!1):g.isOnDeviceRequest(e)?!0:(h.debug("On-device inference unavailable because request is incompatible."),!1)}async generateContent(e){const t=await this.createSession(),s=await Promise.all(e.contents.map(g.toLanguageModelMessage)),o=await t.prompt(s,this.onDeviceParams.promptOptions);return g.toResponse(o)}async generateContentStream(e){const t=await this.createSession(),s=await Promise.all(e.contents.map(g.toLanguageModelMessage)),o=t.promptStreaming(s,this.onDeviceParams.promptOptions);return g.toStreamResponse(o)}async countTokens(e){throw new c(l.REQUEST_ERROR,"Count Tokens is not yet available for on-device model.")}static isOnDeviceRequest(e){if(e.contents.length===0)return h.debug("Empty prompt rejected for on-device inference."),!1;for(const t of e.contents){if(t.parts.some(s=>"functionResponse"in s))return h.debug("Content with a function response part rejected for on-device inference."),!1;for(const s of t.parts)if("inlineData"in s&&s.inlineData&&g.SUPPORTED_MIME_TYPES.indexOf(s.inlineData.mimeType)===-1)return h.debug(`Unsupported mime type "${s.inlineData.mimeType}" rejected for on-device inference.`),!1}return!0}async downloadIfAvailable(e){const t=await this.languageModelProvider?.availability(this.onDeviceParams.createOptions);return(t===O.DOWNLOADABLE||t===O.DOWNLOADING)&&this.download(e),t}download(e){if(this.downloadPromise)return;const t={...this.onDeviceParams.createOptions};t&&!t.monitor&&e&&(t.monitor=s=>{s.addEventListener("downloadprogress",o=>{e(o.loaded)})}),this.downloadPromise=this.languageModelProvider?.create(t).finally(()=>{this.downloadPromise=null})}static async toLanguageModelMessage(e){const t=await Promise.all(e.parts.map(g.toLanguageModelMessageContent));return{role:g.toLanguageModelMessageRole(e.role),content:t}}static async toLanguageModelMessageContent(e){if("text"in e&&typeof e.text=="string")return{type:"text",value:e.text};if("inlineData"in e&&e.inlineData){const s=await(await fetch(`data:${e.inlineData.mimeType};base64,${e.inlineData.data}`)).blob();return{type:"image",value:await createImageBitmap(s)}}throw new c(l.REQUEST_ERROR,"Processing of this Part type is not currently supported.")}static toLanguageModelMessageRole(e){return e==="model"?"assistant":"user"}async createSession(){if(!this.languageModelProvider)throw new c(l.UNSUPPORTED,"Chrome AI requested for unsupported browser version.");const e=await this.languageModelProvider.create(this.onDeviceParams.createOptions);return this.oldSession&&this.oldSession.destroy(),this.oldSession=e,e}static toResponse(e){return{json:async()=>({candidates:[{content:{parts:[{text:e}]}}]})}}static toStreamResponse(e){const t=new TextEncoder;return{body:e.pipeThrough(new TransformStream({transform(s,o){const a=JSON.stringify({candidates:[{content:{role:"model",parts:[{text:s}]}}]});o.enqueue(t.encode(`data: ${a}

`))}}))}}}g.SUPPORTED_MIME_TYPES=["image/jpeg","image/png"];function $e(n,e,t){const o=(e||Me()).LanguageModel;if(o&&n)return new g(o,n,t)}/**
 * @license
 * Copyright 2024 Google LLC
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
 */class Ve{constructor(e,t,s,o,a){this.app=e,this.backend=t,this.chromeAdapterFactory=a;const i=o?.getImmediate({optional:!0}),r=s?.getImmediate({optional:!0});this.auth=r||null,this.appCheck=i||null}_delete(){return Promise.resolve()}set options(e){this._options=e}get options(){return this._options}}/**
 * @license
 * Copyright 2025 Google LLC
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
 */function Be(n,{instanceIdentifier:e}){if(!e)throw new c(l.ERROR,"AIService instance identifier is undefined.");const t=He(e),s=n.getProvider("app").getImmediate(),o=n.getProvider("auth-internal"),a=n.getProvider("app-check-internal");return new Ve(s,t,o,a,$e)}/**
 * @license
 * Copyright 2025 Google LLC
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
 */function re(n){if(n.app?.options?.apiKey)if(n.app?.options?.projectId){if(!n.app?.options?.appId)throw new c(l.NO_APP_ID,'The "appId" field is empty in the local Firebase config. Firebase AI requires this field to contain a valid app ID.')}else throw new c(l.NO_PROJECT_ID,'The "projectId" field is empty in the local Firebase config. Firebase AI requires this field to contain a valid project ID.');else throw new c(l.NO_API_KEY,'The "apiKey" field is empty in the local Firebase config. Firebase AI requires this field to contain a valid API key.');const e={apiKey:n.app.options.apiKey,project:n.app.options.projectId,appId:n.app.options.appId,automaticDataCollectionEnabled:n.app.automaticDataCollectionEnabled,backend:n.backend};if(be(n.app)&&n.app.settings.appCheckToken){const t=n.app.settings.appCheckToken;e.getAppCheckToken=()=>Promise.resolve({token:t})}else n.appCheck&&(n.options?.useLimitedUseAppCheckTokens?e.getAppCheckToken=()=>n.appCheck.getLimitedUseToken():e.getAppCheckToken=()=>n.appCheck.getToken());return n.auth&&(e.getAuthToken=()=>n.auth.getToken()),e}/**
 * @license
 * Copyright 2025 Google LLC
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
 */class b{constructor(e,t){this._apiSettings=re(e),this.model=b.normalizeModelName(t,this._apiSettings.backend.backendType)}static normalizeModelName(e,t){return t===_.GOOGLE_AI?b.normalizeGoogleAIModelName(e):b.normalizeVertexAIModelName(e)}static normalizeGoogleAIModelName(e){return`models/${e}`}static normalizeVertexAIModelName(e){let t;return e.includes("/")?e.startsWith("models/")?t=`publishers/google/${e}`:t=e:t=`publishers/google/models/${e}`,t}}/**
 * @license
 * Copyright 2025 Google LLC
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
 */const Ye="Timeout has expired.",H="AbortError";class We{constructor(e){this.params=e}toString(){const e=new URL(this.baseUrl);return e.pathname=this.pathname,e.search=this.queryParams.toString(),e.toString()}get pathname(){return this.params.templateId?`${this.params.apiSettings.backend._getTemplatePath(this.params.apiSettings.project,this.params.templateId)}:${this.params.task}`:`${this.params.apiSettings.backend._getModelPath(this.params.apiSettings.project,this.params.model)}:${this.params.task}`}get baseUrl(){return this.params.singleRequestOptions?.baseUrl??`https://${se}`}get queryParams(){const e=new URLSearchParams;return this.params.stream&&e.set("alt","sse"),e}}class je{constructor(e){this.apiSettings=e}toString(){const e=new URL(`wss://${se}`);e.pathname=this.pathname;const t=new URLSearchParams;return t.set("key",this.apiSettings.apiKey),e.search=t.toString(),e.toString()}get pathname(){return this.apiSettings.backend instanceof U?`ws/google.firebase.vertexai.v1beta.LlmBidiService/BidiGenerateContent/locations/${this.apiSettings.backend.location}`:"ws/google.firebase.vertexai.v1beta.GenerativeService/BidiGenerateContent"}}function qe(n){const e=[];return e.push(`${ke}/${K}`),e.push(`fire/${K}`),(n.params.apiSettings.inferenceMode===R.PREFER_ON_DEVICE||n.params.apiSettings.inferenceMode===R.PREFER_IN_CLOUD)&&e.push(Ue),e.join(" ")}async function Je(n){const e=new Headers;if(e.append("Content-Type","application/json"),e.append("x-goog-api-client",qe(n)),e.append("x-goog-api-key",n.params.apiSettings.apiKey),n.params.apiSettings.automaticDataCollectionEnabled&&e.append("X-Firebase-Appid",n.params.apiSettings.appId),n.params.apiSettings.getAppCheckToken){const t=await n.params.apiSettings.getAppCheckToken();t&&(e.append("X-Firebase-AppCheck",t.token),t.error&&h.warn(`Unable to obtain a valid App Check token: ${t.error.message}`))}if(n.params.apiSettings.getAuthToken){const t=await n.params.apiSettings.getAuthToken();t&&e.append("Authorization",`Firebase ${t.accessToken}`)}return e}async function D(n,e){const t=new We(n);let s;const o=n.singleRequestOptions?.signal,a=n.singleRequestOptions?.timeout!=null&&n.singleRequestOptions.timeout>=0?n.singleRequestOptions.timeout:xe,i=new AbortController,r=setTimeout(()=>{i.abort(new DOMException(Ye,H)),h.debug(`Aborting request to ${t} due to timeout (${a}ms)`)},a),u=AbortSignal.any(o?[o,i.signal]:[i.signal]);if(o&&o.aborted)throw clearTimeout(r),new DOMException(o.reason??"Aborted externally before fetch",H);try{const d={method:"POST",headers:await Je(t),signal:u,body:e};if(s=await fetch(t.toString(),d),!s.ok){let p="",f;try{const E=await s.json();p=E.error.message,E.error.details&&(p+=` ${JSON.stringify(E.error.details)}`,f=E.error.details)}catch{}throw s.status===403&&f&&f.some(E=>E.reason==="SERVICE_DISABLED")&&f.some(E=>E.links?.[0]?.description.includes("Google developers console API activation"))?new c(l.API_NOT_ENABLED,`The Firebase AI SDK requires the Firebase AI API ('firebasevertexai.googleapis.com') to be enabled in your Firebase project. Enable this API by visiting the Firebase Console at https://console.firebase.google.com/project/${t.params.apiSettings.project}/ailogic/ and clicking "Get started". If you enabled this API recently, wait a few minutes for the action to propagate to our systems and then retry.`,{status:s.status,statusText:s.statusText,errorDetails:f}):new c(l.FETCH_ERROR,`Error fetching from ${t}: [${s.status} ${s.statusText}] ${p}`,{status:s.status,statusText:s.statusText,errorDetails:f})}}catch(d){let p=d;throw d.code!==l.FETCH_ERROR&&d.code!==l.API_NOT_ENABLED&&d instanceof Error&&d.name!==H&&(p=new c(l.ERROR,`Error fetching from ${t.toString()}: ${d.message}`),p.stack=d.stack),p}finally{clearTimeout(r)}return s}/**
 * @license
 * Copyright 2024 Google LLC
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
 */function v(n){if(n.candidates&&n.candidates.length>0){if(n.candidates.length>1&&h.warn(`This response had ${n.candidates.length} candidates. Returning text from the first candidate only. Access response.candidates directly to use the other candidates.`),le(n.candidates[0]))throw new c(l.RESPONSE_ERROR,`Response error: ${A(n)}. Response body stored in error.response`,{response:n});return!0}else return!1}function S(n){return"type"in n&&n.type?n:n.text!==void 0?{...n,type:"text"}:n.inlineData!==void 0?{...n,type:"inlineData"}:n.functionCall!==void 0?{...n,type:"functionCall"}:n.functionResponse!==void 0?{...n,type:"functionResponse"}:n.fileData!==void 0?{...n,type:"fileData"}:n.executableCode!==void 0?{...n,type:"executableCode"}:n.codeExecutionResult!==void 0?{...n,type:"codeExecutionResult"}:n}function P(n,e=T.IN_CLOUD){if(n.candidates?.[0]&&!n.candidates[0].hasOwnProperty("index")&&(n.candidates[0].index=0),n.candidates)for(const s of n.candidates)s.content?.parts&&(s.content.parts=s.content.parts.map(S));const t=Ke(n);return t.inferenceSource=e,t}function Ke(n){return n.text=()=>{if(v(n))return X(n,e=>!("thought"in e&&e.thought));if(n.promptFeedback)throw new c(l.RESPONSE_ERROR,`Text not available. ${A(n)}`,{response:n});return""},n.thoughtSummary=()=>{if(v(n)){const e=X(n,t=>!!("thought"in t&&t.thought));return e===""?void 0:e}else if(n.promptFeedback)throw new c(l.RESPONSE_ERROR,`Thought summary not available. ${A(n)}`,{response:n})},n.inlineDataParts=()=>{if(v(n))return Qe(n);if(n.promptFeedback)throw new c(l.RESPONSE_ERROR,`Data not available. ${A(n)}`,{response:n})},n.functionCalls=()=>{if(v(n))return ce(n);if(n.promptFeedback)throw new c(l.RESPONSE_ERROR,`Function call not available. ${A(n)}`,{response:n})},n}function X(n,e){const t=[];if(n.candidates?.[0].content?.parts)for(const s of n.candidates?.[0].content?.parts){const o=S(s);o.type==="text"&&e(o)&&t.push(o.text)}return t.length>0?t.join(""):""}function ce(n){if(!n)return;const e=[];if(n.candidates?.[0].content?.parts)for(const t of n.candidates?.[0].content?.parts){const s=S(t);s.type==="functionCall"&&e.push(s.functionCall)}if(e.length>0)return e}function Qe(n){const e=[];if(n.candidates?.[0].content?.parts)for(const t of n.candidates?.[0].content?.parts){const s=S(t);s.type==="inlineData"&&e.push(s)}if(e.length>0)return e}const Xe=[m.RECITATION,m.SAFETY,m.BLOCKLIST,m.PROHIBITED_CONTENT,m.SPII,m.MALFORMED_FUNCTION_CALL,m.IMAGE_SAFETY,m.IMAGE_PROHIBITED_CONTENT,m.IMAGE_OTHER,m.NO_IMAGE,m.IMAGE_RECITATION,m.LANGUAGE,m.UNEXPECTED_TOOL_CALL,m.TOO_MANY_TOOL_CALLS,m.MISSING_THOUGHT_SIGNATURE,m.MALFORMED_RESPONSE];function le(n){return!!n.finishReason&&Xe.some(e=>e===n.finishReason)}function A(n){let e="";if((!n.candidates||n.candidates.length===0)&&n.promptFeedback)e+="Response was blocked",n.promptFeedback?.blockReason&&(e+=` due to ${n.promptFeedback.blockReason}`),n.promptFeedback?.blockReasonMessage&&(e+=`: ${n.promptFeedback.blockReasonMessage}`);else if(n.candidates?.[0]){const t=n.candidates[0];le(t)&&(e+=`Candidate was blocked due to ${t.finishReason}`,t.finishMessage&&(e+=`: ${t.finishMessage}`))}return e}/**
 * @license
 * Copyright 2024 Google LLC
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
 */function x(n){if(n!=null){if(typeof n=="string")return{role:"system",parts:[{type:"text",text:n}]};if(n.type==="text"||"text"in n&&typeof n.text=="string")return{role:"system",parts:[y(S(n))]};if(n.parts){const e=n.parts.map(t=>y(S(t)));return n.role?{...n,parts:e}:{role:"system",parts:e}}}}function N(n){let e=[];if(typeof n=="string")e=[{type:"text",text:n}];else for(const t of n)typeof t=="string"?e.push({type:"text",text:t}):e.push(y(S(t)));return ze(e)}function ze(n){const e={role:"user",parts:[]};let t=!1,s=!1;for(const o of n)o.type==="functionResponse"||"functionResponse"in o?s=!0:t=!0,e.parts.push(o);if(t&&s)throw new c(l.INVALID_CONTENT,"Within a single message, FunctionResponse cannot be mixed with other type of Part in the request for sending chat message.");if(!t&&!s)throw new c(l.INVALID_CONTENT,"No Content is provided for sending chat message.");return e}function $(n){let e;if(n.contents){const t=n;e={...t,contents:t.contents.map(s=>({...s,parts:s.parts?s.parts.map(S):[]}))}}else e={contents:[N(n)]};return n.systemInstruction&&(e.systemInstruction=x(n.systemInstruction)),e}function ue(n){return n.parts&&Array.isArray(n.parts)?{...n,parts:n.parts.map(Y)}:n}function Y(n){let e;if("type"in n){const{type:t,...s}=n;e=s}else e=n;return e.functionResponse&&(e={...e,functionResponse:ue(e.functionResponse)}),e}function M(n){return n.parts?{...n,parts:n.parts.map(Y)}:n}function W(n){return n==null||typeof n=="string"?n:"parts"in n&&Array.isArray(n.parts)?M(n):Y(n)}function de(n){const e={...n};return e.contents&&(e.contents=e.contents.map(M)),e.systemInstruction&&(e.systemInstruction=W(e.systemInstruction)),e}function Ze(n){const e={...n};return e.contents&&(e.contents=e.contents.map(M)),e.systemInstruction&&(e.systemInstruction=W(e.systemInstruction)),e}function pe(n){const e={...n};return e.history&&Array.isArray(e.history)&&(e.history=e.history.map(M)),e}/**
 * @license
 * Copyright 2025 Google LLC
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
 */function he(n){if(n.safetySettings?.forEach(e=>{if(e.method)throw new c(l.UNSUPPORTED,"SafetySetting.method is not supported in the the Gemini Developer API. Please remove this property.")}),n.generationConfig?.topK){const e=Math.round(n.generationConfig.topK);e!==n.generationConfig.topK&&(h.warn("topK in GenerationConfig has been rounded to the nearest integer to match the format for requests to the Gemini Developer API."),n.generationConfig.topK=e)}return n}function j(n){return{candidates:n.candidates?tt(n.candidates):void 0,promptFeedback:n.promptFeedback?nt(n.promptFeedback):void 0,usageMetadata:n.usageMetadata}}function et(n,e){return{generateContentRequest:{model:e,...n}}}function tt(n){const e=[];let t;return e&&n.forEach(s=>{let o;if(s.citationMetadata&&(o={citations:s.citationMetadata.citationSources}),s.safetyRatings&&(t=s.safetyRatings.map(i=>({...i,severity:i.severity??oe.HARM_SEVERITY_UNSUPPORTED,probabilityScore:i.probabilityScore??0,severityScore:i.severityScore??0}))),s.content?.parts?.some(i=>"videoMetadata"in i&&i.videoMetadata))throw new c(l.UNSUPPORTED,"Part.videoMetadata is not supported in the Gemini Developer API. Please remove this property.");const a={index:s.index,content:s.content,finishReason:s.finishReason,finishMessage:s.finishMessage,safetyRatings:t,citationMetadata:o,groundingMetadata:s.groundingMetadata,urlContextMetadata:s.urlContextMetadata};e.push(a)}),e}function nt(n){const e=[];return(n.safetyRatings??[]).forEach(s=>{e.push({category:s.category,probability:s.probability,severity:s.severity??oe.HARM_SEVERITY_UNSUPPORTED,probabilityScore:s.probabilityScore??0,severityScore:s.severityScore??0,blocked:s.blocked})}),{blockReason:n.blockReason,safetyRatings:e,blockReasonMessage:n.blockReasonMessage}}/**
 * @license
 * Copyright 2024 Google LLC
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
 */const z=/^data\: (.*)(?:\n\n|\r\r|\r\n\r\n)/;async function fe(n,e,t){const s=n.body.pipeThrough(new TextDecoderStream("utf8",{fatal:!0})),o=at(s),[a,i]=o.tee(),{response:r,firstValue:u}=await st(i,e,t);return{stream:it(a,e,t),response:r,firstValue:u}}async function st(n,e,t){const[s,o]=n.tee(),a=s.getReader(),{value:i}=await a.read();return{firstValue:i,response:ot(o,e,t)}}async function ot(n,e,t){const s=[],o=n.getReader();for(;;){const{done:a,value:i}=await o.read();if(a){let r=rt(s);return e.backend.backendType===_.GOOGLE_AI&&(r=j(r)),P(r,t)}s.push(i)}}async function*it(n,e,t){const s=n.getReader();for(;;){const{value:o,done:a}=await s.read();if(a)break;let i;e.backend.backendType===_.GOOGLE_AI?i=P(j(o),t):i=P(o,t);const r=i.candidates?.[0];!r?.content?.parts&&!r?.finishReason&&!r?.citationMetadata&&!r?.urlContextMetadata||(yield i)}}function at(n){const e=n.getReader();return new ReadableStream({start(s){let o="";return a();function a(){return e.read().then(({value:i,done:r})=>{if(r){if(o.trim()){s.error(new c(l.PARSE_FAILED,"Failed to parse stream"));return}s.close();return}o+=i;let u=o.match(z),d;for(;u;){try{d=JSON.parse(u[1])}catch{s.error(new c(l.PARSE_FAILED,`Error parsing JSON response: "${u[1]}`));return}s.enqueue(d),o=o.substring(u[0].length),u=o.match(z)}return a()})}}})}function rt(n){const t={promptFeedback:n[n.length-1]?.promptFeedback};for(const s of n)if(s.candidates)for(const o of s.candidates){const a=o.index||0;t.candidates||(t.candidates=[]),t.candidates[a]||(t.candidates[a]={index:o.index}),t.candidates[a].citationMetadata=o.citationMetadata,t.candidates[a].finishReason=o.finishReason,t.candidates[a].finishMessage=o.finishMessage,t.candidates[a].safetyRatings=o.safetyRatings,t.candidates[a].groundingMetadata=o.groundingMetadata;const i=o.urlContextMetadata;if(typeof i=="object"&&i!==null&&Object.keys(i).length>0&&(t.candidates[a].urlContextMetadata=i),o.content){if(!o.content.parts)continue;t.candidates[a].content||(t.candidates[a].content={role:o.content.role||"user",parts:[]});for(const r of o.content.parts){if("text"in r&&r.text==="")continue;if(Object.keys(r).length===0)throw new c(l.INVALID_CONTENT,"Part should have at least one property, but there are none. This is likely caused by a malformed response from the backend.");const u=S({...r});Object.keys(u).length>0&&t.candidates[a].content.parts.push(u)}}}return t}/**
 * @license
 * Copyright 2025 Google LLC
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
 */const ct=[l.FETCH_ERROR,l.ERROR,l.API_NOT_ENABLED];async function me(n,e,t,s){if(!e)return{response:await s(),inferenceSource:T.IN_CLOUD};switch(e.mode){case R.ONLY_ON_DEVICE:if(await e.isAvailable(n))return{response:await t(),inferenceSource:T.ON_DEVICE};throw new c(l.UNSUPPORTED,"Inference mode is ONLY_ON_DEVICE, but an on-device model is not available.");case R.ONLY_IN_CLOUD:return{response:await s(),inferenceSource:T.IN_CLOUD};case R.PREFER_IN_CLOUD:try{return{response:await s(),inferenceSource:T.IN_CLOUD}}catch(o){if(o instanceof c&&ct.includes(o.code)&&await e.isAvailable(n))return{response:await t(),inferenceSource:T.ON_DEVICE};throw o}case R.PREFER_ON_DEVICE:return await e.isAvailable(n)?{response:await t(),inferenceSource:T.ON_DEVICE}:{response:await s(),inferenceSource:T.IN_CLOUD};default:throw new c(l.ERROR,`Unexpected infererence mode: ${e.mode}`)}}/**
 * @license
 * Copyright 2024 Google LLC
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
 */async function lt(n,e,t,s){return t=de(t),n.backend.backendType===_.GOOGLE_AI&&(t=he(t)),D({task:"streamGenerateContent",model:e,apiSettings:n,stream:!0,singleRequestOptions:s},JSON.stringify(t))}async function Ee(n,e,t,s,o){const a=await me(t,s,()=>s.generateContentStream(t),()=>lt(n,e,t,o));return fe(a.response,n,a.inferenceSource)}async function ut(n,e,t,s){return t=de(t),n.backend.backendType===_.GOOGLE_AI&&(t=he(t)),D({model:e,task:"generateContent",apiSettings:n,stream:!1,singleRequestOptions:s},JSON.stringify(t))}async function ge(n,e,t,s){const o=pe(t),a=await D({task:"templateGenerateContent",templateId:e,apiSettings:n,stream:!1,singleRequestOptions:s},JSON.stringify(o)),i=await Oe(a,n);return{response:P(i)}}async function Re(n,e,t,s){const o=pe(t),a=await D({task:"templateStreamGenerateContent",templateId:e,apiSettings:n,stream:!0,singleRequestOptions:s},JSON.stringify(o));return fe(a,n)}async function Se(n,e,t,s,o){const a=await me(t,s,()=>s.generateContent(t),()=>ut(n,e,t,o)),i=await Oe(a.response,n);return{response:P(i,a.inferenceSource)}}async function Oe(n,e){const t=await n.json();return e.backend.backendType===_.GOOGLE_AI?j(t):t}/**
 * @license
 * Copyright 2026 Google LLC
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
 */const Z="SILENT_ERROR",ee=10;class _e{constructor(e,t,s){this.params=t,this.requestOptions=s,this._history=[],this._sendPromise=Promise.resolve(),this._apiSettings=e}async getHistory(){return await this._sendPromise,y(this._history).map(e=>({...e,parts:e.parts?e.parts.map(S):[]}))}async _sendMessage(e,t){let s={};await this._sendPromise;const o=[];return this._sendPromise=this._sendPromise.then(async()=>{let a,i=0;const r=this.requestOptions?.maxSequentialFunctionCalls??ee;do{let u;if(a){i++;const f=await this._callFunctionsAsNeeded(a);u=N(f)}else u=N(e);const d=this._formatRequest(u,[...o]);o.push(u);const p=await this._callGenerateContent(d,t);if(p)if(s=p,a=this._getCallableFunctionCalls(p.response),p.response.candidates&&p.response.candidates.length>0){const f={parts:p.response.candidates?.[0].content.parts||[],role:p.response.candidates?.[0].content.role||"model"};o.push(y(f))}else{const f=A(p.response);f&&h.warn(`sendMessage() was unsuccessful. ${f}. Inspect response object for details.`)}else a=void 0}while(a&&i<r);a&&i>=r&&h.warn(`Automatic function calling exceeded the limit of ${r} function calls. Returning last model response.`)}),await this._sendPromise,this._history=this._history.concat(o),s}async _sendMessageStream(e,t){await this._sendPromise;const s=[],a=(async()=>{let i,r=0;const u=this.requestOptions?.maxSequentialFunctionCalls??ee;let d;do{let p;if(i){r++;const E=await this._callFunctionsAsNeeded(i);p=N(E)}else p=N(e);const f=this._formatRequest(p,[...s]);if(s.push(p),d=await this._callGenerateContentStream(f,t),i=this._getCallableFunctionCalls(d.firstValue),i&&d.firstValue&&d.firstValue.candidates&&d.firstValue.candidates.length>0){const E={...d.firstValue.candidates[0].content};E.role||(E.role="model"),s.push(E)}}while(i&&r<u);return i&&r>=u&&h.warn(`Automatic function calling exceeded the limit of ${u} function calls. Returning last model response.`),{stream:d.stream,response:d.response}})();return this._sendPromise=this._sendPromise.then(async()=>a).catch(i=>{throw new Error(Z)}).then(i=>i.response).then(i=>{if(i.candidates&&i.candidates.length>0){this._history=this._history.concat(s);const r={...i.candidates[0].content};r.role||(r.role="model"),this._history.push(y(r))}else{const r=A(i);r&&h.warn(`sendMessageStream() was unsuccessful. ${r}. Inspect response object for details.`)}}).catch(i=>{i.message!==Z&&i.name!=="AbortError"&&h.error(i)}),a}_getCallableFunctionCalls(e){const t=this.params?.tools?.find(o=>o.functionDeclarations);if(!t?.functionDeclarations)return;const s=ce(e);if(s){for(const o of s)if(!t.functionDeclarations?.some(i=>i.name===o.name&&typeof i.functionReference=="function"))return;return s}}async _callFunctionsAsNeeded(e){const t=[],s=[],o=this.params?.tools?.find(a=>a.functionDeclarations);if(o&&o.functionDeclarations){for(const i of e){const r=o.functionDeclarations.find(u=>u.name===i.name);if(r?.functionReference){const u=Promise.resolve(r.functionReference(i.args)).catch(d=>{const p=new c(l.ERROR,`Error in user-defined function "${r.name}": ${d.message}`);throw p.stack=d.stack,p});t.push({name:i.name,id:i.id,results:u}),s.push(u)}}await Promise.all(s);const a=[];for(const{name:i,id:r,results:u}of t){const d={name:i,response:await u};r&&(d.id=r),a.push({type:"functionResponse",functionResponse:d})}return a}else throw new c(l.REQUEST_ERROR,'No function declarations were provided in "tools".')}}/**
 * @license
 * Copyright 2024 Google LLC
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
 */const dt=["text","inlineData","functionCall","functionResponse","thought","thoughtSignature"],pt={user:["text","inlineData","functionResponse"],function:["functionResponse"],model:["text","functionCall","thought","thoughtSignature"],system:["text"]},te={user:["model"],function:["model"],model:["user","function"],system:[]};function Te(n){let e=null;for(const t of n){const{role:s,parts:o}=t;if(!e&&s!=="user")throw new c(l.INVALID_CONTENT,`First Content should be with role 'user', got ${s}`);if(!Q.includes(s))throw new c(l.INVALID_CONTENT,`Each item should include role field. Got ${s} but valid roles are: ${JSON.stringify(Q)}`);if(!Array.isArray(o))throw new c(l.INVALID_CONTENT,"Content should have 'parts' property with an array of Parts");if(o.length===0)throw new c(l.INVALID_CONTENT,"Each Content should have at least one part");const a={text:0,inlineData:0,functionCall:0,functionResponse:0,thought:0,thoughtSignature:0,fileData:0,executableCode:0,codeExecutionResult:0};for(const r of o){if(r.type)a[r.type]+=1;else for(const u of["text","inlineData","functionCall","functionResponse","fileData","executableCode","codeExecutionResult"])u in r&&(a[u]+=1);"thought"in r&&r.thought&&(a.thought+=1),"thoughtSignature"in r&&r.thoughtSignature&&(a.thoughtSignature+=1)}const i=pt[s];for(const r of dt)if(!i.includes(r)&&a[r]>0)throw new c(l.INVALID_CONTENT,`Content with role '${s}' can't contain '${r}' part`);if(e&&!te[s].includes(e.role))throw new c(l.INVALID_CONTENT,`Content with role '${s}' can't follow '${e.role}'. Valid previous roles: ${JSON.stringify(te)}`);e=t}}/**
 * @license
 * Copyright 2024 Google LLC
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
 */class ht extends _e{constructor(e,t,s,o,a){super(e,o,a),this.model=t,this.chromeAdapter=s,this.params=o,this.requestOptions=a,o?.history&&(Te(o.history),this._history=y(o.history)),this.params?.systemInstruction!=null&&(this.params={...this.params,systemInstruction:x(this.params.systemInstruction)})}_formatRequest(e,t){return{safetySettings:this.params?.safetySettings,generationConfig:this.params?.generationConfig,tools:this.params?.tools,toolConfig:this.params?.toolConfig,systemInstruction:this.params?.systemInstruction,contents:[...this._history,...t,e]}}_callGenerateContent(e,t){return Se(this._apiSettings,this.model,e,this.chromeAdapter,{...this.requestOptions,...t})}_callGenerateContentStream(e,t){return Ee(this._apiSettings,this.model,e,this.chromeAdapter,{...this.requestOptions,...t})}async sendMessage(e,t){return this._sendMessage(e,t)}async sendMessageStream(e,t){return this._sendMessageStream(e,t)}}/**
 * @license
 * Copyright 2024 Google LLC
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
 */async function ft(n,e,t,s){t=Ze(t);let o="";if(n.backend.backendType===_.GOOGLE_AI){const i=et(t,e);o=JSON.stringify(i)}else o=JSON.stringify(t);return(await D({model:e,task:"countTokens",apiSettings:n,stream:!1,singleRequestOptions:s},o)).json()}async function mt(n,e,t,s,o){if(s?.mode===R.ONLY_ON_DEVICE)throw new c(l.UNSUPPORTED,"countTokens() is not supported for on-device models.");return ft(n,e,t,o)}/**
 * @license
 * Copyright 2024 Google LLC
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
 */class Et extends b{constructor(e,t,s,o){super(e,t.model),this.chromeAdapter=o,this.generationConfig=t.generationConfig||{},gt(this.generationConfig),this.safetySettings=t.safetySettings||[],this.tools=t.tools,this.toolConfig=t.toolConfig,this.systemInstruction=x(t.systemInstruction),this.requestOptions=s||{}}async initializeDeviceModel(e){if(!this.chromeAdapter||this.chromeAdapter.mode===R.ONLY_IN_CLOUD)return;if(await this.chromeAdapter.downloadIfAvailable(e)===O.UNAVAILABLE){const s=new c(l.API_NOT_ENABLED,"Local LanguageModel API not available in this environment.");if(this.chromeAdapter.mode===R.ONLY_ON_DEVICE)throw s;h.debug(s.message)}await this.chromeAdapter.downloadPromise}async generateContent(e,t){const s=$(e);return Se(this._apiSettings,this.model,{generationConfig:this.generationConfig,safetySettings:this.safetySettings,tools:this.tools,toolConfig:this.toolConfig,systemInstruction:this.systemInstruction,...s},this.chromeAdapter,{...this.requestOptions,...t})}async generateContentStream(e,t){const s=$(e),{stream:o,response:a}=await Ee(this._apiSettings,this.model,{generationConfig:this.generationConfig,safetySettings:this.safetySettings,tools:this.tools,toolConfig:this.toolConfig,systemInstruction:this.systemInstruction,...s},this.chromeAdapter,{...this.requestOptions,...t});return{stream:o,response:a}}startChat(e){return new ht(this._apiSettings,this.model,this.chromeAdapter,{tools:this.tools,toolConfig:this.toolConfig,systemInstruction:this.systemInstruction,generationConfig:this.generationConfig,safetySettings:this.safetySettings,...e},this.requestOptions)}async countTokens(e,t){const s=$(e);return mt(this._apiSettings,this.model,s,this.chromeAdapter,{...this.requestOptions,...t})}}function gt(n){if(n.thinkingConfig?.thinkingBudget!=null&&n.thinkingConfig?.thinkingLevel)throw new c(l.UNSUPPORTED,"Cannot set both thinkingBudget and thinkingLevel in a config.");if(n.responseSchema!=null&&n.responseJsonSchema!=null)throw new c(l.UNSUPPORTED,"Cannot set both responseSchema and responseJsonSchema in a config.");if((n.responseSchema!=null||n.responseJsonSchema!=null)&&n.responseMimeType!=="application/json"&&n.responseMimeType!=="text/x.enum")throw new c(l.UNSUPPORTED,'responseMimeType must be set to "application/json" or "text/x.enum" if responseSchema or responseJsonSchema are set.')}/**
 * @license
 * Copyright 2025 Google LLC
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
 */class Rt{constructor(){if(typeof WebSocket>"u")throw new c(l.UNSUPPORTED,'The WebSocket API is not available in this environment. The "Live" feature is not supported here. It is supported in modern browser windows, Web Workers with WebSocket support, and Node >= 22.')}connect(e){return new Promise((t,s)=>{this.ws=new WebSocket(e),this.ws.binaryType="blob",this.ws.addEventListener("open",()=>t(),{once:!0}),this.ws.addEventListener("error",()=>s(new c(l.FETCH_ERROR,"Error event raised on WebSocket")),{once:!0}),this.ws.addEventListener("close",o=>{o.reason&&h.warn(`WebSocket connection closed by server. Reason: '${o.reason}'`)})})}send(e){if(!this.ws||this.ws.readyState!==WebSocket.OPEN)throw new c(l.REQUEST_ERROR,"WebSocket is not open.");this.ws.send(e)}async*listen(){if(!this.ws)throw new c(l.REQUEST_ERROR,"WebSocket is not connected.");const e=[],t=[];let s=null,o=!1;const a=async u=>{let d;if(u.data instanceof Blob)d=await u.data.text();else if(typeof u.data=="string")d=u.data;else{t.push(new c(l.PARSE_FAILED,`Failed to parse WebSocket response. Expected data to be a Blob or string, but was ${typeof u.data}.`)),s&&(s(),s=null);return}try{const p=JSON.parse(d);e.push(p)}catch(p){const f=p;t.push(new c(l.PARSE_FAILED,`Error parsing WebSocket message to JSON: ${f.message}`))}s&&(s(),s=null)},i=()=>{t.push(new c(l.FETCH_ERROR,"WebSocket connection error.")),s&&(s(),s=null)},r=u=>{u.reason&&h.warn(`WebSocket connection closed by the server with reason: ${u.reason}`),o=!0,s&&(s(),s=null),this.ws?.removeEventListener("message",a),this.ws?.removeEventListener("close",r),this.ws?.removeEventListener("error",i)};for(this.ws.addEventListener("message",a),this.ws.addEventListener("close",r),this.ws.addEventListener("error",i);!o;){if(t.length>0)throw t.shift();e.length>0?yield e.shift():await new Promise(u=>{s=u})}if(t.length>0)throw t.shift()}close(e,t){return new Promise(s=>{if(!this.ws||(this.ws.addEventListener("close",()=>s(),{once:!0}),this.ws.readyState===WebSocket.CLOSED||this.ws.readyState===WebSocket.CONNECTING))return s();this.ws.readyState!==WebSocket.CLOSING&&this.ws.close(e,t)})}}/**
 * @license
 * Copyright 2025 Google LLC
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
 */class St{constructor(e,t,s,o){this._setupMessage=e,this._apiSettings=t,this._sessionResumption=s,this.isClosed=!1,this.inConversation=!1,this._serverMessages=null,this._webSocketHandler=o||new Rt,this.connectionPromise=this._connectSession(this._sessionResumption)}async _connectSession(e){const t=new je(this._apiSettings);await this._webSocketHandler.connect(t.toString());try{this._serverMessages=this._webSocketHandler.listen();const s={...this._setupMessage,setup:{...this._setupMessage.setup}};e&&(s.setup.sessionResumption=e),s.setup.systemInstruction&&(s.setup.systemInstruction=W(s.setup.systemInstruction)),this._webSocketHandler.send(JSON.stringify(s));const o=(await this._serverMessages.next()).value;if(!o||typeof o!="object"||!("setupComplete"in o))throw await this._webSocketHandler.close(1011,"Handshake failure"),new c(l.RESPONSE_ERROR,"Server connection handshake failed. The server did not respond with a setupComplete message.");this.isClosed=!1}catch(s){throw await this._webSocketHandler.close(),s}}async resumeSession(e){if(!this._sessionResumption)throw new c(l.UNSUPPORTED,"Cannot resume session: no sessionResumption config provided");await this.close(),await this._connectSession(e)}async send(e,t=!0){if(this.isClosed)throw new c(l.REQUEST_ERROR,"This LiveSession has been closed and cannot be used.");const s=N(e),o={clientContent:{turns:[M(s)],turnComplete:t}};this._webSocketHandler.send(JSON.stringify(o))}async sendTextRealtime(e){if(this.isClosed)throw new c(l.REQUEST_ERROR,"This LiveSession has been closed and cannot be used.");const t={realtimeInput:{text:e}};this._webSocketHandler.send(JSON.stringify(t))}async sendAudioRealtime(e){if(this.isClosed)throw new c(l.REQUEST_ERROR,"This LiveSession has been closed and cannot be used.");const t={realtimeInput:{audio:e}};this._webSocketHandler.send(JSON.stringify(t))}async sendVideoRealtime(e){if(this.isClosed)throw new c(l.REQUEST_ERROR,"This LiveSession has been closed and cannot be used.");const t={realtimeInput:{video:e}};this._webSocketHandler.send(JSON.stringify(t))}async sendFunctionResponses(e){if(this.isClosed)throw new c(l.REQUEST_ERROR,"This LiveSession has been closed and cannot be used.");const t={toolResponse:{functionResponses:e.map(ue)}};this._webSocketHandler.send(JSON.stringify(t))}async*receive(){if(this.isClosed)throw new c(l.SESSION_CLOSED,"Cannot read from a Live session that is closed. Try starting a new Live session.");if(this._serverMessages)for await(const e of this._serverMessages)if(e&&typeof e=="object")if(w.SERVER_CONTENT in e){const t=e.serverContent;t?.modelTurn?.parts&&(t.modelTurn.parts=t.modelTurn.parts.map(S)),yield{type:"serverContent",...t}}else if(w.TOOL_CALL in e)yield{type:"toolCall",...e.toolCall};else if(w.TOOL_CALL_CANCELLATION in e)yield{type:"toolCallCancellation",...e.toolCallCancellation};else if("goAway"in e){const t=e.goAway;yield{type:w.GOING_AWAY_NOTICE,timeLeft:Ot(t.timeLeft)}}else w.SESSION_RESUMPTION_UPDATE in e?yield{type:w.SESSION_RESUMPTION_UPDATE,...e.sessionResumptionUpdate}:h.warn(`Received an unknown message type from the server: ${JSON.stringify(e)}`);else h.warn(`Received an invalid message from the server: ${JSON.stringify(e)}`)}async close(){this.isClosed||(this.isClosed=!0,await this._webSocketHandler.close(1e3,"Client closed session."))}}function Ot(n){return!n||!n.endsWith("s")?0:Number(n.slice(0,-1))}/**
 * @license
 * Copyright 2025 Google LLC
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
 */class _t extends b{constructor(e,t,s){super(e,t.model),this._webSocketHandler=s,this.generationConfig=t.generationConfig||{},this.tools=t.tools,this.toolConfig=t.toolConfig,this.systemInstruction=x(t.systemInstruction)}async connect(e){let t;this._apiSettings.backend instanceof U?t=`projects/${this._apiSettings.project}/locations/${this._apiSettings.backend.location}/${this.model}`:t=`projects/${this._apiSettings.project}/${this.model}`;const{inputAudioTranscription:s,outputAudioTranscription:o,...a}=this.generationConfig,i=a.contextWindowCompression;delete a.contextWindowCompression;const r={setup:{model:t,generationConfig:a,contextWindowCompression:i,tools:this.tools,toolConfig:this.toolConfig,systemInstruction:this.systemInstruction,inputAudioTranscription:s,outputAudioTranscription:o,sessionResumption:e}},u=new St(r,this._apiSettings,e,this._webSocketHandler);return await u.connectionPromise,u}}/**
 * @license
 * Copyright 2026 Google LLC
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
 */class Tt extends _e{constructor(e,t,s){super(e,t,s),this.params=t,this.requestOptions=s,t.history&&(Te(t.history),this._history=y(t.history))}_formatRequest(e,t){const s={history:[...this._history,...t,e]};return this.params.templateVariables&&(s.inputs=this.params.templateVariables),this.params.tools&&(s.tools=this.params.tools?.map(o=>o.functionDeclarations?{templateFunctions:o.functionDeclarations.map(a=>{if(a.parameters){const i={...a};return delete i.parameters,i.inputSchema=a.parameters,i}return a})}:o)),this.params.toolConfig&&(s.toolConfig=this.params.toolConfig),s}_callGenerateContent(e,t){return ge(this._apiSettings,this.params.templateId,e,{...this.requestOptions,...t})}_callGenerateContentStream(e,t){return Re(this._apiSettings,this.params.templateId,e,{...this.requestOptions,...t})}async sendMessage(e,t){return this._sendMessage(e,t)}async sendMessageStream(e,t){return this._sendMessageStream(e,t)}}/**
 * @license
 * Copyright 2025 Google LLC
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
 */class yt{constructor(e,t){this.requestOptions=t||{},this._apiSettings=re(e)}async generateContent(e,t){return ge(this._apiSettings,e.templateId,{inputs:e.templateVariables,...e.toolConfig!==void 0&&{toolConfig:e.toolConfig}},{...this.requestOptions,...t})}async generateContentStream(e,t){return Re(this._apiSettings,e.templateId,{inputs:e.templateVariables,...e.toolConfig!==void 0&&{toolConfig:e.toolConfig}},{...this.requestOptions,...t})}startChat(e){return new Tt(this._apiSettings,e,this.requestOptions)}}/**
 * @license
 * Copyright 2024 Google LLC
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
 */class I{constructor(e){if(!e.type&&!e.anyOf)throw new c(l.INVALID_SCHEMA,"A schema must have either a 'type' or an 'anyOf' array of sub-schemas.");for(const t in e)this[t]=e[t];this.type=e.type,this.format=e.hasOwnProperty("format")?e.format:void 0,this.nullable=e.hasOwnProperty("nullable")?!!e.nullable:!1}toJSON(){const e={type:this.type};for(const t in this)this.hasOwnProperty(t)&&this[t]!==void 0&&(t!=="required"||this.type===C.OBJECT)&&(e[t]=this[t]);return e}static array(e){return new wt(e,e.items)}static object(e){return new Nt(e,e.properties,e.optionalProperties)}static string(e){return new ne(e)}static enumString(e){return new ne(e,e.enum)}static integer(e){return new At(e)}static number(e){return new Ct(e)}static boolean(e){return new It(e)}static anyOf(e){return new bt(e)}}class At extends I{constructor(e){super({type:C.INTEGER,...e})}}class Ct extends I{constructor(e){super({type:C.NUMBER,...e})}}class It extends I{constructor(e){super({type:C.BOOLEAN,...e})}}class ne extends I{constructor(e,t){super({type:C.STRING,...e}),this.enum=t}toJSON(){const e=super.toJSON();return this.enum&&(e.enum=this.enum),e}}class wt extends I{constructor(e,t){super({type:C.ARRAY,...e}),this.items=t}toJSON(){const e=super.toJSON();return e.items=this.items.toJSON(),e}}class Nt extends I{constructor(e,t,s=[]){super({type:C.OBJECT,...e}),this.properties=t,this.optionalProperties=s}toJSON(){const e=super.toJSON();e.properties={...this.properties};const t=[];if(this.optionalProperties){for(const s of this.optionalProperties)if(!this.properties.hasOwnProperty(s))throw new c(l.INVALID_SCHEMA,`Property "${s}" specified in "optionalProperties" does not exist.`)}for(const s in this.properties)this.properties.hasOwnProperty(s)&&(e.properties[s]=this.properties[s].toJSON(),this.optionalProperties.includes(s)||t.push(s));return t.length>0&&(e.required=t),delete e.optionalProperties,e}}class bt extends I{constructor(e){if(e.anyOf.length===0)throw new c(l.INVALID_SCHEMA,"The 'anyOf' array must not be empty.");super({...e,type:void 0}),this.anyOf=e.anyOf}toJSON(){const e=super.toJSON();return this.anyOf&&Array.isArray(this.anyOf)&&(e.anyOf=this.anyOf.map(t=>t.toJSON())),e}}/**
 * @license
 * Copyright 2025 Google LLC
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
 */const Lt=16e3,Pt=24e3,ye="audio-processor",Dt=`
  class AudioProcessor extends AudioWorkletProcessor {
    constructor(options) {
      super();
      this.targetSampleRate = options.processorOptions.targetSampleRate;
      // 'sampleRate' is a global variable available inside the AudioWorkletGlobalScope,
      // representing the native sample rate of the AudioContext.
      this.inputSampleRate = sampleRate;
    }

    /**
     * This method is called by the browser's audio engine for each block of audio data.
     * Input is a single input, with a single channel (input[0][0]).
     */
    process(inputs) {
      const input = inputs[0];
      if (input && input.length > 0 && input[0].length > 0) {
        const pcmData = input[0]; // Float32Array of raw audio samples.
        
        // Simple linear interpolation for resampling.
        const resampled = new Float32Array(Math.round(pcmData.length * this.targetSampleRate / this.inputSampleRate));
        const ratio = pcmData.length / resampled.length;
        for (let i = 0; i < resampled.length; i++) {
          resampled[i] = pcmData[Math.floor(i * ratio)];
        }

        // Convert Float32 (-1, 1) samples to Int16 (-32768, 32767)
        const resampledInt16 = new Int16Array(resampled.length);
        for (let i = 0; i < resampled.length; i++) {
          const sample = Math.max(-1, Math.min(1, resampled[i]));
          if (sample < 0) {
            resampledInt16[i] = sample * 32768;
          } else {
            resampledInt16[i] = sample * 32767;
          }
        }
        
        this.port.postMessage(resampledInt16);
      }
      // Return true to keep the processor alive and processing the next audio block.
      return true;
    }
  }

  // Register the processor with a name that can be used to instantiate it from the main thread.
  registerProcessor('${ye}', AudioProcessor);
`;class Mt{constructor(e,t,s){this.liveSession=e,this.options=t,this.deps=s,this.isStopped=!1,this.stopDeferred=new Le,this.playbackQueue=[],this.scheduledSources=[],this.nextStartTime=0,this.isPlaybackLoopRunning=!1,this.liveSession.inConversation=!0,this.receiveLoopPromise=this.runReceiveLoop().finally(()=>this.cleanup()),this.deps.workletNode.port.onmessage=o=>{if(this.isStopped)return;const a=o.data,r={mimeType:"audio/pcm",data:btoa(String.fromCharCode.apply(null,Array.from(new Uint8Array(a.buffer))))};this.liveSession.sendAudioRealtime(r)}}async stop(){this.isStopped||(this.isStopped=!0,this.stopDeferred.resolve(),await this.receiveLoopPromise)}cleanup(){this.interruptPlayback(),this.deps.workletNode.port.onmessage=null,this.deps.workletNode.disconnect(),this.deps.sourceNode.disconnect(),this.deps.mediaStream.getTracks().forEach(e=>e.stop()),this.deps.audioContext.state!=="closed"&&this.deps.audioContext.close(),this.liveSession.inConversation=!1}enqueueAndPlay(e){this.playbackQueue.push(e),this.processPlaybackQueue()}interruptPlayback(){[...this.scheduledSources].forEach(e=>e.stop(0)),this.playbackQueue.length=0,this.nextStartTime=this.deps.audioContext.currentTime}async processPlaybackQueue(){if(!this.isPlaybackLoopRunning){for(this.isPlaybackLoopRunning=!0;this.playbackQueue.length>0&&!this.isStopped;){const e=this.playbackQueue.shift();try{const t=new Int16Array(e),s=t.length,o=this.deps.audioContext.createBuffer(1,s,Pt),a=o.getChannelData(0);for(let r=0;r<s;r++)a[r]=t[r]/32768;const i=this.deps.audioContext.createBufferSource();i.buffer=o,i.connect(this.deps.audioContext.destination),this.scheduledSources.push(i),i.onended=()=>{this.scheduledSources=this.scheduledSources.filter(r=>r!==i)},this.nextStartTime=Math.max(this.deps.audioContext.currentTime,this.nextStartTime),i.start(this.nextStartTime),this.nextStartTime+=o.duration}catch(t){h.error("Error playing audio:",t)}}this.isPlaybackLoopRunning=!1}}async runReceiveLoop(){const e=this.liveSession.receive();for(;!this.isStopped;){const t=await Promise.race([e.next(),this.stopDeferred.promise]);if(this.isStopped||!t||t.done)break;const s=t.value;if(s.type==="serverContent"){const o=s;o.interrupted&&this.interruptPlayback();const a=o.modelTurn?.parts.find(i=>i?.type==="inlineData"&&i.inlineData?.mimeType?.startsWith("audio/"));if(a&&a.type==="inlineData"){const i=Uint8Array.from(atob(a.inlineData.data),r=>r.charCodeAt(0)).buffer;this.enqueueAndPlay(i)}}else if(s.type==="toolCall")if(!this.options.functionCallingHandler)h.warn("Received tool call message, but StartAudioConversationOptions.functionCallingHandler is undefined. Ignoring tool call.");else try{const o=await this.options.functionCallingHandler(s.functionCalls);this.isStopped||this.liveSession.sendFunctionResponses([o])}catch(o){throw new c(l.ERROR,`Function calling handler failed: ${o.message}`)}}}}async function Xt(n,e={}){if(n.isClosed)throw new c(l.SESSION_CLOSED,"Cannot start audio conversation on a closed LiveSession.");if(n.inConversation)throw new c(l.REQUEST_ERROR,"An audio conversation is already in progress for this session.");if(typeof AudioWorkletNode>"u"||typeof AudioContext>"u"||typeof navigator>"u"||!navigator.mediaDevices)throw new c(l.UNSUPPORTED,"Audio conversation is not supported in this environment. It requires the Web Audio API and AudioWorklet support.");let t;try{t=new AudioContext,t.state==="suspended"&&await t.resume();const s=await navigator.mediaDevices.getUserMedia({audio:!0}),o=new Blob([Dt],{type:"application/javascript"}),a=URL.createObjectURL(o);await t.audioWorklet.addModule(a);const i=t.createMediaStreamSource(s),r=new AudioWorkletNode(t,ye,{processorOptions:{targetSampleRate:Lt}});i.connect(r);const u=new Mt(n,e,{audioContext:t,mediaStream:s,sourceNode:i,workletNode:r});return{stop:()=>u.stop()}}catch(s){throw t&&t.state!=="closed"&&t.close(),s instanceof c||s instanceof DOMException?s:new c(l.ERROR,`Failed to initialize audio recording: ${s.message}`)}}/**
 * @license
 * Copyright 2024 Google LLC
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
 */function zt(n=Ne(),e){n=Ie(n);const t=we(n,L),s=e?.backend??new B,o=Fe(s),a=t.getImmediate({identifier:o}),i=a.options;if(i){const r=e?.useLimitedUseAppCheckTokens,u=!!i.useLimitedUseAppCheckTokens;if(r!=null&&!!r!==u)throw new c(l.ALREADY_INITIALIZED,`getAI() has already been called for app "${n.name}" and this backend with useLimitedUseAppCheckTokens: ${u}. This option cannot be changed after the AI instance has been initialized. Pass the desired options to the first getAI() call for this app and backend, or omit useLimitedUseAppCheckTokens to reuse the existing instance.`);return a}return a.options={useLimitedUseAppCheckTokens:e?.useLimitedUseAppCheckTokens??!1},a}const vt=["mode","onDeviceParams","inCloudParams"];function Zt(n,e,t){const s=e;let o;if(s.mode){for(const r of Object.keys(e))vt.includes(r)||h.warn(`When a hybrid inference mode is specified (mode is currently set to ${s.mode}), "${r}" cannot be configured at the top level. Configuration for in-cloud and on-device must be done separately in inCloudParams and onDeviceParams. Configuration values set outside of inCloudParams and onDeviceParams will be ignored.`);o=s.inCloudParams||{model:Ge}}else o=e;if(!o.model)throw new c(l.NO_MODEL,"Must provide a model name. Example: getGenerativeModel({ model: 'my-model-name' })");const a=n.chromeAdapterFactory?.(s.mode,typeof window>"u"?void 0:window,s.onDeviceParams),i=new Et(n,o,t,a);return i._apiSettings.inferenceMode=s.mode,i}function en(n,e){if(!e.model)throw new c(l.NO_MODEL,"Must provide a model name for getLiveGenerativeModel. Example: getLiveGenerativeModel(ai, { model: 'my-model-name' })");return new _t(n,e)}function tn(n,e){return new yt(n,e)}/**
 * @license
 * Copyright 2025 Google LLC
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
 */function kt(){Pe(new De(L,Be,"PUBLIC").setMultipleInstances(!0)),q(J,V),q(J,V,"esm2020")}kt();export{c as AIError,l as AIErrorCode,b as AIModel,U as AgentPlatformBackend,bt as AnyOfSchema,wt as ArraySchema,ie as Backend,_ as BackendType,$t as BlockReason,It as BooleanSchema,m as FinishReason,Yt as FunctionCallingMode,Et as GenerativeModel,B as GoogleAIBackend,Ft as HarmBlockMethod,Gt as HarmBlockThreshold,xt as HarmCategory,Ht as HarmProbability,oe as HarmSeverity,Vt as ImageConfigAspectRatio,Bt as ImageConfigImageSize,R as InferenceMode,T as InferenceSource,At as IntegerSchema,Jt as Language,_t as LiveGenerativeModel,w as LiveResponseType,St as LiveSession,Wt as Modality,Ct as NumberSchema,Nt as ObjectSchema,qt as Outcome,Q as POSSIBLE_ROLES,jt as ResponseModality,I as Schema,C as SchemaType,ne as StringSchema,yt as TemplateGenerativeModel,Kt as ThinkingLevel,Qt as URLRetrievalStatus,zt as getAI,Zt as getGenerativeModel,en as getLiveGenerativeModel,tn as getTemplateGenerativeModel,Xt as startAudioConversation};
