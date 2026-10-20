#!/bin/zsh
set -euo pipefail
cd "${0:A:h}"
APP="$PWD/飞跃日程规划本.app"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
swiftc main.swift -o "$APP/Contents/MacOS/Feiyue" -framework Cocoa -framework SwiftUI -module-cache-path /tmp/feiyue-swift-cache
cp assets/*.png "$APP/Contents/Resources/"
cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleExecutable</key><string>Feiyue</string>
<key>CFBundleIdentifier</key><string>local.feiyue.desktop</string>
<key>CFBundleName</key><string>飞跃日程规划本</string>
<key>CFBundleVersion</key><string>1</string>
<key>CFBundleShortVersionString</key><string>0.1.0</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>LSUIElement</key><true/>
<key>NSHighResolutionCapable</key><true/>
<key>LSMinimumSystemVersion</key><string>13.0</string>
</dict></plist>
PLIST
codesign --force --sign - "$APP"
echo "$APP"
