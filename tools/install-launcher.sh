#!/usr/bin/env bash
# Add "Procgen Critters" to the desktop application menu (per-user, no sudo).
set -e
here="$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)"
dir="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
mkdir -p "$dir"
cat > "$dir/procgen-critters.desktop" <<EOD
[Desktop Entry]
Type=Application
Name=Procgen Critters
Comment=Silhouette marginalia critters along borders on PDFs
Exec="$here/critters"
Path=$here
Terminal=true
Categories=Graphics;
EOD
echo "Installed $dir/procgen-critters.desktop"
