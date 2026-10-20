import * as THREE from '../vendor/three.module.js';
// [직접 수정] 원본에는 애니메이션 클립이 없어 실제 본을 회전시키는 기본 보행을 만든다.
// 이 동작은 모션 캡처가 아니다. stride·각도 값을 바꾸면 보폭/팔 흔들림이 달라진다.
export function createAvatarMotion(bones) {
  const joints=bones.map(bone=>({bone,rest:bone.quaternion.clone(),axis:new THREE.Vector3(1,0,0).applyQuaternion(bone.getWorldQuaternion(new THREE.Quaternion()).invert())}));
  const turn=new THREE.Quaternion();let phase=0,amount=0;
  return (dt,speed,running)=>{
    const moving=speed>.05;
    amount=THREE.MathUtils.lerp(amount,moving?1:0,1-Math.exp(-12*dt));
    if(moving)phase+=dt*(running?12:8)*Math.min(speed/(running?7.5:4),1.4);
    for(const {bone,rest,axis} of joints){
      let angle=0;
      const side=bone.name.includes('.L')?1:-1;
      const wave=Math.sin(phase+(side===1?0:Math.PI));
      if(/^thigh\.[LR]$/.test(bone.name) || /^pelvis\.[LR]\.00[1-5]$/.test(bone.name)) angle=wave*(running?.65:.4);
      else if(/^shin\.[LR]$/.test(bone.name))angle=-Math.max(0,-wave)*(running?.85:.55);
      else if(/^upper_arm\.[LR](\.00[1-5])?$/.test(bone.name))angle=-wave*(running?.5:.28);
      else if(/^forearm\.[LR]$/.test(bone.name))angle=.12+Math.max(0,wave)*.2;
      else if(/^foot\.[LR]$/.test(bone.name))angle=-wave*.12;
      bone.quaternion.copy(rest).multiply(turn.setFromAxisAngle(axis,angle*amount));
    }
  };
}
