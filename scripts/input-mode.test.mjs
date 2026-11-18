import assert from 'node:assert/strict';
import {chooseInputMode} from '../js/input-mode.js';
for(const maxTouchPoints of [0,10])assert.equal(chooseInputMode({userAgent:'Windows NT 10.0',platform:'Win32',maxTouchPoints}),'pc');
assert.equal(chooseInputMode({userAgent:'Macintosh',platform:'MacIntel',maxTouchPoints:0}),'pc');
assert.equal(chooseInputMode({userAgent:'Macintosh',platform:'MacIntel',maxTouchPoints:5}),'touch');
for(const userAgent of ['Android','iPhone','iPad'])assert.equal(chooseInputMode({userAgent,maxTouchPoints:5}),'touch');
assert.equal(chooseInputMode({userAgent:'X11; Linux x86_64',maxTouchPoints:10}),'pc');
console.log('PASS: device-based PC/touch classification including touch laptop and iPad desktop UA');
