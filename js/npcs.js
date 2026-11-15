import { measureStage, yieldFrame, recordStage } from "./docent-performance.js";
import { warmupDocent } from "./docent-warmup.js";
import { waitForStartupTextures } from "./startup-textures.js";
import { readResponse } from "./binary.js";
import { createNpcRig } from "./npc-rig.js";
import { createMapMaterials } from "./map-materials.js";
import { loadKnightModel } from "./knight-model.js";
import placements from "../data/npcs.json";

// Positions and common 1.8-unit model scaling come from data/npcs.json.
// Knight uses its native GLB rig; Rook and Pawn B retain the binary worker path.
export function addNpcs(scene, renderer, camera, getAttentionTarget = () => null) {
  const avatars = [];
  const cylinders = placements.map(placement => ({
    x: placement.x,
    z: placement.z,
    bottom: placement.y,
    top: placement.y + 1.82 * (placement.scale ?? 1),
    radius: placement.collisionRadius * (placement.scale ?? 1),
  }));

  async function load() {
    let worker;
    let workerUrl;
    const local = location.protocol === "file:";

    async function legacyWorker() {
      if (worker) return worker;
      const start = performance.now();
      workerUrl = local
        ? URL.createObjectURL(new Blob([
          await (await readResponse("js/docent-worker.bundle.js")).text(),
        ], { type: "text/javascript" }))
        : new URL("js/docent-worker.bundle.js", document.baseURI);
      worker = new Worker(workerUrl);
      recordStage("all", "worker-bootstrap", start);
      return worker;
    }

    async function loadLegacyNpc(placement) {
      const decoder = await legacyWorker();
      const response = await measureStage(placement.id, "asset-read", () =>
        readResponse(`data/npc-${placement.id}.pack`));
      if (!response.ok) throw new Error("도슨트 파일을 읽을 수 없습니다.");
      const source = await measureStage(placement.id, "asset-buffer", () => response.arrayBuffer());
      const data = await measureStage(placement.id, "worker-decode", () => new Promise((resolve, reject) => {
        decoder.onmessage = ({ data: message }) => {
          if (message.error) return reject(new Error(message.error));
          if (message.timings) recordStage(placement.id, "worker-decode-detail", performance.now(), {
            workerTimings: message.timings,
          });
          resolve(message.rig);
        };
        decoder.onerror = event => reject(new Error(event.message));
        decoder.postMessage(source, [source]);
      }));
      await yieldFrame();
      const materials = await measureStage(placement.id, "materials", () => createMapMaterials(data));
      // Preserve the original texture transforms of the two legacy models.
      materials.forEach((material, index) => {
        for (const key of ["map", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap"]) {
          const transform = data.materials[index][`${key}Transform`];
          if (!material[key] || !transform) continue;
          const texture = material[key].clone();
          texture.offset.fromArray(transform.offset);
          texture.repeat.fromArray(transform.repeat);
          texture.rotation = transform.rotation;
          material[key] = texture;
        }
      });
      return measureStage(placement.id, "rig-total-including-yields", () => createNpcRig(data, materials));
    }

    try {
      for (const placement of placements) {
        const group = placement.id === "knight"
          ? (await measureStage(placement.id, "native-glb-load", () => loadKnightModel())).group
          : await loadLegacyNpc(placement);
        group.userData.npcId = placement.id;
        group.scale.setScalar(placement.scale ?? 1);
        group.position.set(placement.x, placement.y, placement.z);
        group.rotation.y = placement.rotation;
        await warmupDocent(group, scene, camera, renderer, placement.id);
        await yieldFrame();
        avatars.push(group);
        scene.add(group);
      }
    } finally {
      worker?.terminate();
      if (local && workerUrl) URL.revokeObjectURL(workerUrl);
    }
  }

  let started = false;
  const update = dt => {
    const target = getAttentionTarget();
    for (const avatar of avatars) {
      avatar.userData.setAttention?.(target);
      avatar.userData.updateIdle(dt);
    }
  };
  update.begin = () => {
    if (started) return;
    started = true;
    // Keep the map responsive while NPC textures, rigs and shaders prepare.
    measureStage("all", "wait-startup-textures-including-yields", () => waitForStartupTextures())
      .then(load)
      .catch(error => {
        console.error(error);
        window.dispatchEvent(new ErrorEvent("error", {
          message: `도슨트 로드 실패: ${error.message}`,
          error,
        }));
      });
  };
  update.avatars = avatars;
  update.cylinders = cylinders;
  return update;
}
