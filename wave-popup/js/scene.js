import * as THREE from '../vendor/three.module.js';
import mapData from '../data/map.json';
import settings from '../data/scene.json';
import { createMovementInput } from './movement-input.js';
import { applyLookDelta, viewDirection } from './camera-controls.js';

// [구조 설명] FBX의 정적 형상은 data/map.json으로 변환해 보관한다.
// 원본 재질이 없어 중립색을 사용하며, Three.js는 중앙 scene 요소 안에서만 그린다.
export function startScene(initialView) {
  const host = document.getElementById('scene');
  const status = document.getElementById('sceneStatus');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true }); }
  catch { status.textContent = '3D 화면을 열 수 없습니다. WebGL을 지원하는 브라우저로 다시 열어 주세요.'; return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color('white');
  const camera = new THREE.PerspectiveCamera(48, 1, .08, 250);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x77818d, 2.2));
  const sunlight = new THREE.DirectionalLight(0xfff1dc, 2.5);
  sunlight.position.set(-25, 55, 30); scene.add(sunlight);
  const meshes = [];
  for (const data of mapData) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
    geometry.setIndex(data.indices); geometry.computeVertexNormals();
    // [직접 수정] 바닥/구조물의 임시 색상. 원본 FBX에는 재질이 없다.
    const color = data.name === 'Cylinder.001' ? 0xdce2e5 : data.name.startsWith('Cube') ? 0x8faaaa : 0xb7c7c4;
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: .85, side: THREE.DoubleSide, flatShading: true }));
    mesh.name = data.name; meshes.push(mesh); scene.add(mesh);
  }
  scene.updateMatrixWorld(true);
  // [직접 수정] 조종 캐릭터의 색·형상. 위치는 player 상태를 따라간다.
  const avatar = new THREE.Group(); scene.add(avatar);
  const part = (geometry, color, y) => {
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({color}));
    mesh.position.y = y; avatar.add(mesh);
  };
  part(new THREE.CylinderGeometry(.25,.32,1,16),0xb34e54,.6);
  part(new THREE.SphereGeometry(.26,16,12),0xf0d4b3,1.4);
  part(new THREE.ConeGeometry(.31,.45,16),0x17374e,1.75);
  const player = {x:settings.spawn[0],y:0,z:settings.spawn[1],yaw:0,pitch:0};
  const ray = new THREE.Raycaster();
  const ground = (x,z,ceiling=40) => {
    ray.far = 100; ray.set(new THREE.Vector3(x,ceiling,z),new THREE.Vector3(0,-1,0));
    return ray.intersectObjects(meshes,false).find(hit=>Math.abs(hit.face.normal.y)>.55);
  };
  const spawnHit = ground(player.x,player.z);
  if (!spawnHit) { status.textContent='시작 위치에 바닥이 없습니다. scene.json의 spawn을 확인해 주세요.'; return; }
  player.y=spawnHit.point.y;
  let third = initialView !== 'first-person', drag=null;
  const input=createMovementInput();
  const reset=()=>{input.clear();drag=null;};
  // [구조 설명] 벽과 높이 차이를 확인한 뒤에만 이동한다. 점프/물리 엔진은 포함하지 않는다.
  function tryMove(dx,dz) {
    const length=Math.hypot(dx,dz); if(!length)return;
    for(const height of [.4,1.15]) {
      ray.far=length+.28;
      ray.set(new THREE.Vector3(player.x,player.y+height,player.z),new THREE.Vector3(dx,0,dz).normalize());
      if(ray.intersectObjects(meshes,false).some(hit=>Math.abs(hit.face.normal.y)<.65))return;
    }
    const hit=ground(player.x+dx,player.z+dz,player.y+settings.stepHeight);
    if(!hit || player.y-hit.point.y>settings.maxDrop)return;
    player.x+=dx;player.z+=dz;player.y=hit.point.y;
    avatar.rotation.y=Math.atan2(dx,dz);
  }
  document.addEventListener('popup:view-change',event=>{third=event.detail!=='first-person';reset();host.focus();});
  window.addEventListener('keydown',event=>{
    if(event.target.closest('button,input,textarea,select') || event.target.isContentEditable)return;
    if(input.keyDown(event))event.preventDefault();
  });
  window.addEventListener('keyup',event=>input.keyUp(event),true);
  window.addEventListener('blur',reset);document.addEventListener('visibilitychange',reset);
  renderer.domElement.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;host.focus();drag={x:event.clientX,y:event.clientY};renderer.domElement.setPointerCapture(event.pointerId);
  });
  renderer.domElement.addEventListener('pointermove',event=>{
    if(!drag)return;applyLookDelta(player,event.clientX-drag.x,event.clientY-drag.y);drag={x:event.clientX,y:event.clientY};
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture']) renderer.domElement.addEventListener(type,()=>drag=null);
  // [구조 설명] wheel/pinch로 카메라 거리를 바꾸는 로직은 없다. 줌 기능을 제공하지 않는다.
  const resize=()=>{const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();};
  new ResizeObserver(resize).observe(host);resize();
  // [구조 설명] 미니맵은 실제 메시의 삼각형을 평면 투영해 한 번 그리고 플레이어 위치만 갱신한다.
  const mini=document.getElementById('miniCanvas'),ctx=mini.getContext('2d');
  const base=document.createElement('canvas');base.width=base.height=280;
  const bc=base.getContext('2d'); const X=x=>140+x*3.5,Z=z=>140+z*3.5;
  for(const data of mapData){bc.fillStyle=data.name==='Cylinder.001'?'#b5c0c7':'#758f90';for(let i=0;i<data.indices.length;i+=3){bc.beginPath();for(let j=0;j<3;j++){const k=data.indices[i+j]*3;const x=X(data.positions[k]),y=Z(data.positions[k+2]);j?bc.lineTo(x,y):bc.moveTo(x,y);}bc.closePath();bc.fill();}}
  let previous=performance.now(),frame=0;
  function animate(now){
    requestAnimationFrame(animate);const dt=Math.min((now-previous)/1000,.05);previous=now;
    let x=+input.has('right')-input.has('left'),z=+input.has('down')-input.has('up');
    const length=Math.hypot(x,z);
    if(length){const speed=(input.has('sprint')?settings.runSpeed:settings.walkSpeed)*dt/length;x*=speed;z*=speed;tryMove(x*Math.cos(player.yaw)+z*Math.sin(player.yaw),0);tryMove(0,-x*Math.sin(player.yaw)+z*Math.cos(player.yaw));}
    avatar.position.set(player.x,player.y,player.z);avatar.visible=third;
    if(third){
      const elevation=THREE.MathUtils.clamp(settings.thirdPersonElevation-player.pitch,.2,1.3);
      const target=new THREE.Vector3(player.x,player.y+1,player.z);
      const offset=new THREE.Vector3(Math.sin(player.yaw)*Math.cos(elevation),Math.sin(elevation),Math.cos(player.yaw)*Math.cos(elevation));
      // 벽 뒤로 카메라가 들어가지 않도록 가림 물체 앞까지 당긴다. 사용자가 조절하는 줌과는 별개다.
      ray.far=settings.thirdPersonDistance;ray.set(target,offset);
      const hit=ray.intersectObjects(meshes,false)[0];const distance=hit?Math.max(.3,hit.distance-.2):settings.thirdPersonDistance;
      camera.position.copy(target).addScaledVector(offset,distance);camera.lookAt(target);
    }else{const direction=viewDirection(player.yaw,player.pitch);camera.position.set(player.x,player.y+settings.eyeHeight,player.z);camera.lookAt(player.x+direction.x,player.y+settings.eyeHeight+direction.y,player.z+direction.z);}
    renderer.render(scene,camera);
    if(++frame%6===0 && ctx){ctx.clearRect(0,0,280,280);ctx.drawImage(base,0,0);ctx.fillStyle='#ad3749';ctx.beginPath();ctx.arc(X(player.x),Z(player.z),5,0,Math.PI*2);ctx.fill();}
  }
  status.hidden=true;requestAnimationFrame(animate);
}
