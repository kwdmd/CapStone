import * as T from "../vendor/three.module.js";

// 포스터가 붙은 뒷벽 양 끝의 XZ 좌표, 부스 바닥 높이와 깊이(맵 단위).
const booths = [
  [[-23.92,-13.96],[-16.10,-19.98],1.33,8,1],
  [[15.25,11.56],[23.92,5.77],3.98,8,1],
  [[-34,9.3],[-33.7,19.6],3.98,9,5],
];
function inBooth(x,z,y) {
  return booths.some(([[ax,az],[bx,bz],floor,depth,extension])=>{
    const length=Math.hypot(bx-ax,bz-az), dx=(bx-ax)/length, dz=(bz-az)/length;
    const along=(x-ax)*dx+(z-az)*dz;
    return Math.abs(y-floor)<0.08 && along>=-extension && along<=length+extension &&
      Math.abs((x-ax)*dz-(z-az)*dx)<=depth;
  });
}

// 바닥은 기존 하향 레이가 실제 삼각면을 그대로 밟는다. 수직면만 이동 차단 선분으로 추가한다.
export function addBoothCollision(scene, map) {
  const barriers=[], seen=new Set();
  for(const part of map){
    const kind=/^Cylinder\.030_([024567])$/.exec(part.name)?.[1];
    if(!kind) continue;
    for(let t=0;t<part.indices.length;t+=3){
      const pts=[0,1,2].map(j=>{const i=part.indices[t+j]*3;return Array.from(part.positions.slice(i,i+3));});
      const ys=pts.map(p=>p[1]), low=Math.min(...ys), high=Math.max(...ys);
      const x=(pts[0][0]+pts[1][0]+pts[2][0])/3,z=(pts[0][2]+pts[1][2]+pts[2][2])/3;
      // 동쪽 전시 부스: 꺾인 흰 벽과 계단 옆의 받침 수직면까지 포함한다.
      const east = x >= 11.6 && x <= 26.6 && z >= -5.65 && z <= 11.9;
      const endPanel = x >= 26.2 && x <= 29.8 && z >= -5.7 && z <= -3.8;
      const sideWall = kind==="0" && (east || endPanel) && Math.abs(low-3.98)<0.08 && Math.abs(high-9.04)<0.12;
      // 낮은 부스의 앞 모서리: 받침 외곽과 계단에 접하는 짧은 흰 턱만 선택한다.
      const onEdge=(ax,az,bx,bz)=>{
        const dx=bx-ax,dz=bz-az;
        const t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));
        return Math.hypot(x-ax-t*dx,z-az-t*dz)<0.18;
      };
      const frontLip = Math.abs(high-1.33)<0.04 &&
        (onEdge(-11.45,-12.2,-16.1,-20.2) || onEdge(-11.45,-12.2,-14.6,-9.8));
      const base = kind==="0" && high-low>0.12 && (frontLip || (east && Math.abs(high-3.98)<0.08));
      if(!sideWall && !base && !inBooth(x,z,low))continue;
      if(base || sideWall || ("0567".includes(kind) && high-low>3.8)){
        // 수직 벽 삼각형의 수평 투영은 선분이다. 벽 두께/상판 삼각형은 걸러낸다.
        const pairs=[[0,1],[1,2],[2,0]].map(([a,b])=>[pts[a],pts[b],
          Math.hypot(pts[a][0]-pts[b][0],pts[a][2]-pts[b][2])]).sort((a,b)=>b[2]-a[2]);
        const [a,b,len]=pairs[0];
        const area=Math.abs((pts[1][0]-pts[0][0])*(pts[2][2]-pts[0][2])-(pts[1][2]-pts[0][2])*(pts[2][0]-pts[0][0]));
        if(len<0.04||area/len>0.16)continue;

        const start=[a[0],a[2]],end=[b[0],b[2]];
        const key=[start,end].map(v=>v.map(n=>n.toFixed(2)).join(",")).sort().join("|")+low.toFixed(2)+high.toFixed(2);
        if(!seen.has(key)){seen.add(key);barriers.push({start,end,bottom:low,top:high,thickness:0.04});}
      }
    }
  }

  // 체크 통로의 바깥 모서리: 흰 단상에서 원형 받침까지. 렌더링 없이 이동만 막는다.
  const edge = [[11.64, 3.80], [7.90, 4.94], [4.00, 5.36]];
  for (let i = 1; i < edge.length; i++) {
    barriers.push({ start: edge[i-1], end: edge[i], bottom: 0, top: 3.75, thickness: 0.04 });
  }
  // 실제 수직면의 수평 모서리를 사용해 꺾이는 난간과 성곽 입구를 그대로 따른다.
  const rails = new Map();
  for (const part of map) {
    const red = part.name === "Cylinder_1";
    const castle = part.name === "Cylinder.006_0";
    if (!red && !castle && part.name !== "Cylinder_0") continue;
    for (let i = 0; i < part.indices.length; i += 3) {
      const points = [0, 1, 2].map(j => {
        const k = part.indices[i + j] * 3;
        return [part.positions[k], part.positions[k + 1], part.positions[k + 2]];
      });
      const low = Math.min(...points.map(p => p[1]));
      const high = Math.max(...points.map(p => p[1]));
      if (high - low < 0.1) continue;
      const radii = points.map(([x,,z]) => Math.hypot(x - 4, z - 14.27));
      if (castle) {
        if (Math.abs(low - 9.48) > 0.03 || high > 10.02) continue;
        // 원본의 안쪽 성벽과 입구 양끝의 방사형 단면을 선택하고, 넓힌 좌표에 벽을 세운다.
        const source = part.castleSourcePositions ?? part.positions;
        const originalRadii = [0, 1, 2].map(j => {
          const k = part.indices[i + j] * 3;
          return Math.hypot(source[k] - 4, source[k + 2] - 14.27);
        });
        const radialSpan = Math.max(...originalRadii) - Math.min(...originalRadii);
        if (Math.max(...originalRadii) > 4.15 && radialSpan < 0.25) continue;
      }
      if (!castle && !red && (high > 8.5 || radii.some(r => Math.abs(r - 5.60) > 0.09))) continue;
      // 마지막 단 아래의 받침 모서리는 상단으로 이어지는 통로를 가로지른다.
      if (!castle && !red && high > 8.29 && low < 4.1) continue;
      for (let j = 0; j < 3; j++) {
        const a = points[j], b = points[(j + 1) % 3];
        if (Math.abs(a[1] - high) > 0.01 || Math.abs(b[1] - high) > 0.01) continue;
        if (Math.hypot(a[0] - b[0], a[2] - b[2]) < 0.035) continue;
        const start = [a[0], a[2]], end = [b[0], b[2]];
        const key = [start, end].map(p => p.map(n => n.toFixed(3)).join(",")).sort().join("|");
        const bottom = castle || red ? low : high;
        const previous = rails.get(key);
        if (!previous || bottom > previous.bottom)
          rails.set(key, {start, end, bottom, top: bottom + 2.7, thickness: 0.04, isStairRail: true});
      }
    }
  }
  return barriers.concat([...rails.values()]);
}
// 상단 출구의 원래 폭은 약 1.62로 플레이어 지름(1.632)보다 좁다.
// 출구 중심선을 기준으로 양옆을 조금 넓혀 바닥·난간 모델과 판정을 함께 맞춘다.
export function widenCastleEntrance(map) {
  const angle = 48.4 * Math.PI / 180;
  const dx = Math.cos(angle), dz = Math.sin(angle);
  return map.map(part => {
    if (!/^Cylinder(?:_[012]|\.006_0)$/.test(part.name)) return part;
    const positions = part.positions.slice();
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i] - 4, z = positions[i+2] - 14.27;
      const along = x*dx + z*dz, side = z*dx - x*dz;
      const taper = Math.max(0, Math.min(1, along-2, 7-along, 3-Math.abs(side), positions[i+1]-7));
      const offset = Math.max(-1, Math.min(1, side)) * 0.30 * taper;
      positions[i] -= dz * offset;
      positions[i+2] += dx * offset;
    }
    if (part.name === "Cylinder.006_0") return {...part, positions, castleSourcePositions: part.positions};
    return {...part, positions};
  });
}