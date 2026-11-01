import assert from 'node:assert/strict';
import { bindNpcDialogue } from '../js/npc-dialogue.js';
const make=()=>({hidden:true,dataset:{},textContent:'',handlers:{},addEventListener(k,f){this.handlers[k]=f;},setAttribute(k,v){this[k]=v;},focus(){},closest(){return null;}});
const elements=Object.fromEntries(['npcDialogue','npcPrompt','npcClose','npcText','npcName','npcSymbol','npcPiece'].map(k=>[k,make()]));
const buttons=['intro','piece','guide'].map(topic=>Object.assign(make(),{dataset:{topic}}));
elements.npcDialogue.querySelectorAll=()=>buttons;
globalThis.document={getElementById:k=>elements[k],querySelector:()=>({classList:{add(){},remove(){}}})};
const keys={};globalThis.window={addEventListener:(k,f)=>keys[k]=f};
const host=make(),canvas=make(),player={x:0,y:0,z:0};let resets=0;
const avatars=['rook','knight','pawn-b'].map((id,i)=>({position:{x:i*20,y:0,z:0},userData:{npcId:id}}));
const dialogue=bindNpcDialogue({host,canvas,camera:{},meshes:[],avatars,player,reset:()=>resets++});
for(const [i,name] of ['룩 안내자','나이트 안내자','폰 안내자'].entries()){
 player.x=i*20;dialogue.update();assert.equal(elements.npcPrompt.hidden,false);
 assert.ok(elements.npcPrompt.textContent.startsWith('F · '));
 assert.equal(typeof elements.npcPrompt.handlers.click,"function");
 assert.equal(canvas.handlers.pointerup,undefined);
 keys.keydown({code:'KeyE',target:make(),preventDefault(){}});assert.equal(dialogue.isOpen(),false);
 if (i === 1) elements.npcPrompt.handlers.click();
 else keys.keydown({code:'KeyF',target:make(),preventDefault(){}});
 assert.equal(dialogue.isOpen(),true);assert.equal(elements.npcName.textContent,name);assert.equal(host.dataset.dialogueOpen,'true');
 buttons[1].handlers.click();assert.ok(elements.npcText.textContent.length>20);assert.equal(buttons[1]['aria-pressed'],'true');
 keys.keydown({code:'Escape',preventDefault(){}});assert.equal(dialogue.isOpen(),false);assert.equal(elements.npcDialogue.hidden,true);assert.equal(host.dataset.dialogueOpen,'false');
}
player.x=100;dialogue.update();assert.equal(elements.npcPrompt.hidden,true);assert.equal(resets,6);
keys.keydown({code:'KeyF',target:make(),preventDefault(){}});assert.equal(dialogue.isOpen(),false);
console.log('PASS: three NPC identities, proximity prompt, topic switching, escape and input reset');

// 축소된 상호작용 경계: 안내 표시와 실제 F 입력이 같은 범위를 사용합니다.
player.x=23.01;player.z=0;dialogue.update();
assert.equal(elements.npcPrompt.hidden,true);
keys.keydown({code:'KeyF',target:make(),preventDefault(){}});assert.equal(dialogue.isOpen(),false);
player.x=23;dialogue.update();assert.equal(elements.npcPrompt.hidden,false);
keys.keydown({code:'KeyF',target:make(),preventDefault(){}});
assert.equal(elements.npcName.textContent,'나이트 안내자');assert.equal(dialogue.isOpen(),true);
keys.keydown({code:'Escape',preventDefault(){}});
player.x=22.2;player.z=2.2;dialogue.update();assert.equal(elements.npcPrompt.hidden,true);
console.log('PASS: 3-unit interaction boundary, out-of-range F blocked, diagonal distance');
