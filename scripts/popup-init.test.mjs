import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import { bindViewShortcut } from "../js/view-shortcut.js";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const source = fs.readFileSync(new URL("../js/popup.js", import.meta.url), "utf8")
  .replace(/^import .*;\r?\n/gm, "");
function element() {
  const attributes = new Map();
  const listeners = new Map();
  return {
    dataset: {}, inside: true,
    setAttribute: (name, value) => attributes.set(name, value),
    getAttribute: name => attributes.get(name) ?? "",
    addEventListener: (name, listener) => listeners.set(name, listener),
    removeEventListener: name => listeners.delete(name),
    fire: (name, event) => listeners.get(name)?.(event),
    replaceChildren() {}, append() {},
    classList: { toggle() { return false; } },
  };
}
const nodes = new Map([...html.matchAll(/id="([^"]+)"/g)].map(match => [match[1], element()]));
const root = element();
const brand = element();
root.contains = target => !!target?.inside;
root.querySelector = selector => selector === "#scene" ? nodes.get("scene") : null;
const doc = element();
doc.defaultView = element();
doc.body = {};
doc.documentElement = {};
doc.getElementById = id => nodes.get(id) ?? null;
doc.querySelector = selector => selector === ".popup" ? root : selector === ".brand" ? brand : null;
doc.createElement = element;
doc.createTextNode = text => text;
const changes = [];
doc.dispatchEvent = event => changes.push(event);
root.ownerDocument = doc;
let started = false;
vm.runInNewContext(source, {
  document: doc,
  config: { projectName: "Chess Gambit", pageTitle: "Chess Gambit", initialView: "third-person", soundEnabled: true },
  bindViewShortcut,
  CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
  initCart() {}, initTouchGuide() {}, startScene() { started = true; },
});
assert.ok(started, "UI initialization must reach startScene with actual HTML IDs");
const button = nodes.get("viewButton");
assert.equal(nodes.get("cameraStateText").textContent, "3P");
button.fire("click");
assert.equal(nodes.get("cameraStateText").textContent, "1P");
assert.equal(button.getAttribute("aria-label"), "3인칭으로 전환");
let prevented = false;
doc.fire("keydown", { code: "KeyV", key: "ㅍ", target: nodes.get("scene"), preventDefault() { prevented = true; } });
doc.fire("keyup", { code: "KeyV" });
assert.equal(nodes.get("cameraStateText").textContent, "3P");
assert.equal(button.getAttribute("aria-label"), "1인칭으로 전환");
assert.equal(button.title, "1인칭으로 전환 (V)");
assert.equal(prevented, true);
assert.deepEqual(changes.map(event => [event.type, event.detail]), [
  ["popup:view-change", "first-person"], ["popup:view-change", "third-person"],
]);
button.disabled = true;
button.fire("click");
assert.equal(changes.length, 2, "Disabled button cannot toggle through the shared action");
console.log("PASS: UI startup and shared button/V camera state, labels and events");
