import assert from 'node:assert/strict';
import { joystickVector } from '../js/touch-controls.js';
import { createMovementInput } from '../js/movement-input.js';
assert.deepEqual(joystickVector(1, 1, 50), {x:0,z:0,sprint:false});
assert.equal(joystickVector(0,-25,50).sprint,false);
assert.equal(joystickVector(0,-40,50).sprint,true);
assert.equal(joystickVector(0,-34,50,true).sprint,true);
assert.equal(joystickVector(0,-30,50,true).sprint,false);
const diagonal=joystickVector(30,-30,50);
assert.ok(Math.abs(Math.hypot(diagonal.x,diagonal.z)-1)<1e-10);
const input=createMovementInput();
input.setTouch(diagonal.x,diagonal.z,true);
assert.equal(input.has('sprint'),true);
assert.deepEqual(input.axes(),{x:diagonal.x,z:diagonal.z});
input.clear();
assert.deepEqual(input.axes(),{x:0,z:0});
assert.equal(input.has('sprint'),false);
input.keyDown({code:'KeyW'});
assert.equal(input.axes().z,-1);
input.keyUp({code:'KeyW'});
assert.equal(input.axes().z,0);
console.log('PASS: joystick dead zone, walk/run hysteresis, diagonal direction, reset and keyboard');

for (const code of ['ShiftLeft', 'ShiftRight']) {
 input.clear(); input.keyDown({code:'KeyW'}); input.keyDown({code});
 assert.equal(input.has('sprint'),true);
 assert.equal(input.axes().z,-1);
 input.keyUp({code}); assert.equal(input.has('sprint'),false);
 assert.equal(input.axes().z,-1);
}
input.keyDown({code:'ShiftLeft'}); input.keyDown({code:'ShiftRight'});
input.keyUp({code:'ShiftLeft'}); assert.equal(input.has('sprint'),true);
input.keyUp({code:'ShiftRight'}); assert.equal(input.has('sprint'),false);
input.keyDown({code:'ShiftRight'}); input.clear(); assert.equal(input.has('sprint'),false);
console.log('PASS: left/right Shift sprint, release, simultaneous modifiers and reset');

for (const event of [
 {code:'',key:'Shift',location:2,shiftKey:true},
 {code:'Unidentified',key:'Shift',location:2,shiftKey:true},
 {code:'',keyCode:16,location:2,shiftKey:true},
 {code:'',key:'Shift',location:0,shiftKey:true}
]) {
 input.clear(); input.keyDown({code:'KeyW',shiftKey:false});
 assert.equal(input.keyDown(event),true);assert.equal(input.has('sprint'),true);
 input.keyUp({...event,shiftKey:false});assert.equal(input.has('sprint'),false);assert.equal(input.axes().z,-1);
}
input.clear();input.keyDown({code:'KeyW',shiftKey:true});assert.equal(input.has('sprint'),true);
input.keyDown({code:'KeyW',repeat:true,shiftKey:false});assert.equal(input.has('sprint'),false);
input.keyDown({code:'ShiftLeft',key:'Shift',location:1,shiftKey:true});
input.keyDown({code:'ShiftRight',key:'Shift',location:2,shiftKey:true});
input.keyUp({code:'ShiftLeft',key:'Shift',location:1,shiftKey:true});assert.equal(input.has('sprint'),true);
input.keyUp({code:'ShiftRight',key:'Shift',location:2,shiftKey:false});assert.equal(input.has('sprint'),false);
console.log('PASS: missing Shift code, location fallback, modifier recovery and release');
