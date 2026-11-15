// 반경 r 원 안에 동시에 들어올 수 있는 고정 광원의 최대 개수입니다.
// 최대 포함 원은 점 하나를 중심으로 하거나 두 점을 원주에 두는 후보로 검사할 수 있습니다.
// 통행 영역을 제한하지 않는 보수적 상한이므로 맵 어느 곳에서 이동해도 준비 수가 부족하지 않습니다.
export function maximumLightsInRadius(anchors, radius) {
  if (!anchors.length) return 0;
  const r = radius + 1e-6; // 경계 부동소수점 오차는 준비 개수가 많아지는 쪽으로 처리
  let maximum = 0;
  const inspect = (x,z) => {
    const count = anchors.reduce((sum,a) => sum + (Math.hypot(a.x-x,a.z-z) <= r+1e-6 ? 1 : 0),0);
    maximum = Math.max(maximum,count);
  };
  anchors.forEach(a => inspect(a.x,a.z));
  for (let i=0;i<anchors.length;i++) for(let j=i+1;j<anchors.length;j++) {
    const a=anchors[i],b=anchors[j],dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz);
    if (d<1e-9 || d>2*r) continue;
    const h=Math.sqrt(Math.max(0,r*r-d*d/4)),mx=(a.x+b.x)/2,mz=(a.z+b.z)/2;
    inspect(mx-dz*h/d,mz+dx*h/d);inspect(mx+dz*h/d,mz-dx*h/d);
  }
  return maximum;
}
