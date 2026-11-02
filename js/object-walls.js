// 사전 계산한 오브젝트 표면과 치마 폭을 포함하는 플레이어 원통을 비교한다.
export function touchesObjectWall(grid, player, x, z, floorY, radius, height) {
  const { cell, walls } = grid;
  const bottom = Math.min(player.y, floorY) + cell;
  const top = Math.max(player.y, floorY) + height;
  for (let ix = Math.floor((x-radius)/cell); ix <= Math.floor((x+radius)/cell); ix++) {
    for (let iz = Math.floor((z-radius)/cell); iz <= Math.floor((z+radius)/cell); iz++) {
      const ranges = walls[ix+","+iz];
      if (!ranges) continue;
      const left = ix*cell, back = iz*cell;
      const distance = (px,pz) => Math.max(left-px,0,px-left-cell)**2 +
        Math.max(back-pz,0,pz-back-cell)**2;
      const next = distance(x,z);
      if (next >= radius*radius || next >= distance(player.x,player.z)) continue;
      for (let i=0; i<ranges.length; i+=2) {
        if (ranges[i]*cell < top && ranges[i+1]*cell > bottom) return true;
      }
    }
  }
  return false;
}
