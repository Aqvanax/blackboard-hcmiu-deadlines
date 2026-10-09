#!/usr/bin/env node
// Ghép src/ thành blackboard-deadlines.user.js và copy src/core.js sang sync/core.js.
// Chạy: node build.js hoặc npm run build, không cần thư viện ngoài.
'use strict';

const fs = require('fs');
const path = require('path');

const root = __dirname;
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const trimEnd = (s) => s.replace(/\s+$/, '');

const meta = trimEnd(read('src/userscript.meta.js'));
const core = trimEnd(read('src/core.js'));
const body = trimEnd(read('src/userscript.body.js'));

const banner = '/* Tạo bởi build.js, hãy sửa src/ rồi chạy node build.js */';

const output = [
  meta,
  '',
  banner,
  '(function () {',
  "'use strict';",
  '',
  '/* src/core.js */',
  core,
  '',
  '/* src/userscript.body.js */',
  body,
  '})();',
  ''
].join('\n');

const outPath = path.join(root, 'blackboard-deadlines.user.js');
fs.writeFileSync(outPath, output);

fs.mkdirSync(path.join(root, 'sync'), { recursive: true });
fs.copyFileSync(path.join(root, 'src', 'core.js'), path.join(root, 'sync', 'core.js'));

// Extension MV3 dùng chung file built, không cần Tampermonkey.
fs.mkdirSync(path.join(root, 'extension'), { recursive: true });
fs.writeFileSync(path.join(root, 'extension', 'bb.js'), output);

console.log('Đã build: blackboard-deadlines.user.js, sync/core.js, extension/bb.js');
