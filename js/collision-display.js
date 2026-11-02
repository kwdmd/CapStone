import * as T from "../vendor/three.module.js";

// 이동 판정에 쓰이는 좌표만 읽는다. 표시용 메시는 충돌 검사 목록에 넣지 않는다.
export function showCollisionWalls(scene, { cell, walls }, cylinders, fences) {
  // 직접 수정: 0에 가까울수록 희미해진다.
  const material = new T.MeshBasicMaterial({
    color: 0x53ddd1, transparent: true, opacity: 0.12, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  });
  const vertices = [], indices = [];
  function quad(a,b,c,d) {
    const i = vertices.length / 3;
    vertices.push(...a,...b,...c,...d);
    indices.push(i,i+1,i+2,i,i+2,i+3);
  }
  for (const [key, spans] of Object.entries(walls)) {
    const [i,k] = key.split(",").map(Number);
    const x=i*cell, z=k*cell, X=x+cell, Z=z+cell;
    const sides = [
      [i-1,k,x,z,x,Z], [i+1,k,X,Z,X,z],
      [i,k-1,X,z,x,z], [i,k+1,x,Z,X,Z],
    ];
    for (let j=0;j<spans.length;j+=2) {
      const low=spans[j], high=spans[j+1], y=low*cell, Y=high*cell;
      quad([x,Y,z],[x,Y,Z],[X,Y,Z],[X,Y,z]);
      quad([x,y,z],[X,y,z],[X,y,Z],[x,y,Z]);
      // 이웃 칸과 겹치는 높이 구간은 생략해 내부 면이 진해지지 않게 한다.
      for (const [ni,nk,x1,z1,x2,z2] of sides) {
        const other=walls[ni+","+nk] ?? [];
        let cursor=low;
        const face=(lo,hi)=>quad([x1,lo*cell,z1],[x2,lo*cell,z2],[x2,hi*cell,z2],[x1,hi*cell,z1]);
        for(let n=0;n<other.length && cursor<high;n+=2) {
          if(other[n+1]<=cursor) continue;
          if(other[n]>=high) break;
          if(other[n]>cursor) face(cursor,other[n]);
          cursor=Math.max(cursor,other[n+1]);
        }
        if(cursor<high) face(cursor,high);
      }
    }
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute("position",new T.Float32BufferAttribute(vertices,3));
  geometry.setIndex(indices);
  scene.add(new T.Mesh(geometry,material));
  function instances(shape,items,place) {
    if (!items.length) return;
    const mesh=new T.InstancedMesh(shape,material,items.length);
    const pose=new T.Object3D();
    items.forEach((item,i)=>{place(pose,item);pose.updateMatrix();mesh.setMatrixAt(i,pose.matrix);});
    scene.add(mesh);
  }
  instances(new T.CylinderGeometry(1,1,1,36),cylinders,(pose,c)=>{
    pose.position.set(c.x,(c.top+c.bottom)/2,c.z);
    pose.scale.set(c.radius,c.top-c.bottom,c.radius);
  });
  instances(new T.BoxGeometry(1,1,1),fences,(pose,f)=>{
    const [x,z]=f.start,[X,Z]=f.end;
    pose.position.set((x+X)/2,(f.top+f.bottom)/2,(z+Z)/2);
    pose.rotation.y=-Math.atan2(Z-z,X-x);
    pose.scale.set(Math.hypot(X-x,Z-z),f.top-f.bottom,f.thickness);
  });
}
import { playerCollisionSize } from "./player-collision-size.js";

// 원통은 도슨트·울타리 판정, 발밑의 작은 고리는 일반 표면 벽 판정의 폭이다.
export function createPlayerCollisionDisplay(scene, settings) {
  const {radius, height, surfaceRatio} = playerCollisionSize(settings);
  const display = new T.Group();
  const shell = new T.Mesh(new T.CylinderGeometry(radius, radius, height, 48),
    new T.MeshBasicMaterial({color:0x53ddd1, transparent:true, opacity:0.12, depthWrite:false}));
  shell.position.y = height / 2;
  const inner = radius * surfaceRatio;
  const ring = new T.Mesh(new T.RingGeometry(inner - 0.015, inner, 48),
    new T.MeshBasicMaterial({color:0x53ddd1, transparent:true, opacity:0.55, depthWrite:false}));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.015;
  display.add(shell, ring);
  scene.add(display);
  return display;
}
