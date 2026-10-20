import packed from '../data/map-packed.json' with {type:'json'};
import { gunzipSync, strFromU8 } from '../vendor/fflate.module.js';
// [구조 설명] UV·노멀을 보존하면 JSON이 커지므로 압축해서 배포하고 시작 시 한 번 복원한다.
export default JSON.parse(strFromU8(gunzipSync(Uint8Array.from(atob(packed),c=>c.charCodeAt(0)))));
