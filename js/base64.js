// Use the browser's native decoder when available; preserve older-browser support.
export function decodeBase64(value) {
  if (typeof Uint8Array.fromBase64 === "function") {
    return Uint8Array.fromBase64(value);
  }
  const decoded = atob(value);
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
    bytes[i] = decoded.charCodeAt(i);
  }
  return bytes;
}
