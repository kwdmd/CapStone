import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {createAvatar} from '../js/avatar.js';
import {wheelPixels,zoomValue} from '../js/camera-zoom.js';
const avatar=createAvatar();
const samples=[];
avatar.updateMatrixWorld(true);
for(const mesh of avatar.children.filter(m=>m.isSkinnedMesh)){
  const positions=mesh.geometry.attributes.position;
  for(let i=0;i<positions.count;i+=97){
    const rest=new T.Vector3().fromBufferAttribute(positions,i);
    const bound=mesh.applyBoneTransform(i,rest.clone());
    assert.ok(bound.distanceTo(rest)<1e-5,'Bind pose must preserve vertices');
    samples.push({mesh,i,rest});
  }
}
for(let i=0;i<30;i++)avatar.userData.updateMotion(1/60,4,false);
avatar.updateMatrixWorld(true);
let moved=0;
for(const s of samples){
 const p=s.mesh.applyBoneTransform(s.i,s.rest.clone());
 assert.ok(p.toArray().every(Number.isFinite));
 if(p.distanceTo(s.rest)>.01)moved++;
}
assert.ok(moved>10,'Walking must deform actual vertices');
for(let i=0;i<180;i++)avatar.userData.updateMotion(1/60,0,false);
avatar.updateMatrixWorld(true);
for(const s of samples)assert.ok(s.mesh.applyBoneTransform(s.i,s.rest.clone()).distanceTo(s.rest)<1e-5);
assert.equal(wheelPixels(3,1),48);
assert.equal(wheelPixels(1,2),240);
assert.ok(zoomValue(32,-120,3,45)<32);
assert.equal(zoomValue(32,1e5,3,45),45);
assert.equal(zoomValue(32,-1e5,3,45),3);
console.log('PASS: bind pose, skinned walking, stop pose, wheel units and zoom bounds');
