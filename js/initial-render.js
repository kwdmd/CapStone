import * as THREE from "../vendor/three.module.js";
import { recordStage } from "./docent-performance.js";

// [측정] 비교판에서 최초 화면 렌더 한 번만 GL 호출의 CPU 시간을 집계한다.
// 드라이버 대기가 포함될 수 있으며 GPU 자체의 작업 시간은 아니다.
export function installInitialRenderProbe(renderer) {
  const render = renderer.render;
  renderer.render = function (...args) {
    renderer.render = render;
    const gl = renderer.getContext(), saved = [], calls = {};
    const start = performance.now();
    const cpu = {}, restoreCpu = [];
    const instrument = (owner, name, label) => {
      const original = owner[name]; let depth = 0;
      const stats = cpu[label] = { count: 0, totalMs: 0, maxMs: 0 };
      owner[name] = function (...values) {
        const outer = depth++ === 0, t = performance.now();
        try { return original.apply(this, values); }
        finally {
          depth--;
          if (outer) { const elapsed=performance.now()-t; stats.count++;stats.totalMs+=elapsed;stats.maxMs=Math.max(stats.maxMs,elapsed); }
          if (label === "skinnedBoundingSphere") recordStage("startup","cpu-skinned-bounds",t,{mesh:this.name,vertices:this.geometry.attributes.position.count});
        }
      };
      restoreCpu.push(()=>{owner[name]=original;});
    };
    instrument(THREE.SkinnedMesh.prototype,"computeBoundingSphere","skinnedBoundingSphere");
    instrument(THREE.BufferGeometry.prototype,"computeBoundingSphere","geometryBoundingSphere");
    instrument(THREE.Object3D.prototype,"updateMatrixWorld","matrixWorld");
    instrument(renderer,"renderBufferDirect","renderBufferDirect");
    for (const name of ["bufferData", "bufferSubData", "texImage2D", "texSubImage2D", "texStorage2D", "generateMipmap", "compileShader", "linkProgram", "getProgramParameter", "getShaderParameter", "drawElements", "drawArrays"]) {
      const original = gl[name];
      if (typeof original !== "function") continue;
      const stats = calls[name] = { count: 0, totalMs: 0, maxMs: 0 };
      try {
        gl[name] = function (...values) {
          const t = performance.now();
          try { return original.apply(this, values); }
          finally { const elapsed = performance.now() - t; stats.count++; stats.totalMs += elapsed; stats.maxMs = Math.max(stats.maxMs, elapsed); }
        };
        saved.push([name, original]);
      } catch { stats.unavailable = true; }
    }
    try { return render.apply(this, args); }
    finally {
      saved.forEach(([name, original]) => { gl[name] = original; });
      restoreCpu.reverse().forEach(restore=>restore());
      recordStage("startup", "initial-render-gl-summary", start, { calls, cpu });
    }
  };
}

