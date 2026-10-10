#!/usr/bin/env bash
# Đóng extension/ thành gói zip upload Chrome Web Store.
set -euo pipefail
cd "$(dirname "$0")/.."
test -f extension/bb.js || { echo 'extension/bb.js chưa có, chạy node build.js trước'; exit 1; }
rm -f store/blackboard-deadlines-extension.zip
(cd extension && zip -qr ../store/blackboard-deadlines-extension.zip manifest.json bb.js icons)
echo 'store/blackboard-deadlines-extension.zip'
unzip -l store/blackboard-deadlines-extension.zip | tail -n +1
