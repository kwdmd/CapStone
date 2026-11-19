import fs from 'node:fs/promises';import assert from 'node:assert/strict';import zlib from 'node:zlib';
import * as THREE from '../vendor/three.module.js';
import {createNpcRig} from '../js/npc-rig.js';
import {decodeNpcBinary} from '../js/npc-binary.js';
globalThis.requestAnimationFrame=f=>setImmediate(f);
const motion=JSON.parse(await fs.readFile(new URL('../data/docent-knight-idle.json',import.meta.url),'utf8'));
const report=[];
for(const id of ['rook','pawn-b']){
const data=decodeNpcBinary(new Uint8Array(zlib.gunzipSync(await fs.readFile(new URL('../data/npc-'+id+'.pack',import.meta.url)))));
const group=await createNpcRig(data,data.materials.map(()=>new THREE.MeshBasicMaterial()));group.updateMatrixWorld(true);
const names=['hand.L','hand.R','foot.L','foot.R',id==='rook'?'spine.006':'spine.006.R'];
const initial=Object.fromEntries(names.map(n=>[n,group.getObjectByName(n).getWorldPosition(new THREE.Vector3())]));const drift=Object.fromEntries(names.map(n=>[n,0]));
for(let f=0;f<600;f++){group.userData.updateIdle(1/120);group.updateMatrixWorld(true);for(const n of names){const p=group.getObjectByName(n).getWorldPosition(new THREE.Vector3());assert(p.toArray().every(Number.isFinite));drift[n]=Math.max(drift[n],p.distanceTo(initial[n]));}}
for(const n of ['foot.L','foot.R'])assert(drift[n]<1e-6,id+' foot fixed '+n);
if(id==='rook')for(const n of ['hand.L','hand.R'])assert(drift[n]<1e-5,'Rook clasp preserved '+n);
assert(drift[names[4]]>.0001,'Idle visibly changes head position');
for(const q of Object.values(motion[data.name].tracks)){assert.deepEqual(q.slice(0,4),q.slice(-4));for(let i=0;i<q.length;i+=4)assert(Math.abs(Math.hypot(...q.slice(i,i+4))-1)<1e-5);}
report.push({id,seconds:5,samples:600,maxDrift:drift});
}
console.log('PASS: retargeted loops, finite poses, fixed feet, Rook clasp',JSON.stringify(report));
