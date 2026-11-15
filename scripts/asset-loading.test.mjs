import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { readAsset } from "../js/binary.js";
import { decodeBase64 } from "../js/base64.js";

const expectedBytes = Uint8Array.from({ length: 256 }, (_, i) => i);
const encoded = Buffer.from(expectedBytes).toString("base64");
assert.deepEqual(decodeBase64(encoded), expectedBytes);
const native = Uint8Array.fromBase64;
try {
  Uint8Array.fromBase64 = undefined;
  assert.deepEqual(decodeBase64(` \n${encoded}\n`), expectedBytes);
  assert.deepEqual(decodeBase64(""), new Uint8Array());
  assert.throws(() => decodeBase64("invalid!"));
} finally {
  if (native === undefined) delete Uint8Array.fromBase64;
  else Uint8Array.fromBase64 = native;
}

// Mixed float/index arrays must preserve exact bits through gzip and delta decoding.
const values = new Float32Array([0, -0, 1.25, -2.5, Infinity, -Infinity]);
const indices = new Uint16Array([0, 1, 65535]);
const raw = new Uint8Array(values.byteLength + indices.byteLength);
const floatBytes = new Uint8Array(values.buffer);
for (let byte = 0; byte < 4; byte++) {
  let previous = 0;
  for (let i = 0; i < values.length; i++) {
    const value = floatBytes[i * 4 + byte];
    raw[byte * values.length + i] = (value - previous) & 255;
    previous = value;
  }
}
raw.set(new Uint8Array(indices.buffer), values.byteLength);
const mesh = {
  positions: { type: "Float32Array", off: 0, len: values.length, encoding: "byte-delta" },
  indices: { type: "Uint16Array", off: values.byteLength, len: indices.length },
};
const previousLocation = globalThis.location;
const previousFetch = globalThis.fetch;
globalThis.location = { protocol: "http:" };
try {
  for (const meta of [[mesh], { meshes: [mesh] }]) {
    globalThis.fetch = async url => url.endsWith(".json")
      ? Response.json(meta) : new Response(gzipSync(raw));
    const decoded = await readAsset("fixture");
    const actual = (decoded.meshes ?? decoded)[0];
    assert.deepEqual(new Uint8Array(actual.positions.buffer, 0, values.byteLength), floatBytes);
    assert.deepEqual(actual.indices, indices);
    assert.equal(actual.positions.buffer, actual.indices.buffer);
  }
  globalThis.fetch = async () => new Response("missing", { status: 404 });
  await assert.rejects(readAsset("missing"), /HTTP 404/);
} finally {
  globalThis.fetch = previousFetch;
  if (previousLocation === undefined) delete globalThis.location;
  else globalThis.location = previousLocation;
}
console.log("PASS: native/fallback base64, exact packed float/index bytes, both metadata shapes and HTTP errors");
