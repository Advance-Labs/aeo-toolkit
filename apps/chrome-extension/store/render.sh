#!/bin/zsh
# Renders every frame in frames/ to export/ as 24-bit PNG (no alpha) with agent-browser + sharp.
# Usage: store/render.sh   (from anywhere; needs `pnpm install` done for sharp)
set -e
setopt extendedglob
cd "$(dirname "$0")"
S=store-render
ab(){ agent-browser --session $S "$@"; }
render() { # file w h out
  [[ $4 == [A-Za-z0-9._-]##.png ]] || { echo "bad output name: $4" >&2; exit 1; }
  ab set viewport "$2" "$3" >/dev/null
  ab open "file://$PWD/frames/$1" >/dev/null
  ab wait 600 >/dev/null
  ab screenshot "$PWD/export/.raw-$4" >/dev/null
  # Paths go in as argv, never spliced into the JS source.
  node -e 'const [raw,out]=process.argv.slice(1);require("sharp")(raw).flatten({background:"#ece8e1"}).removeAlpha().png().toFile(out).then(()=>require("fs").unlinkSync(raw))' "export/.raw-$4" "export/$4"
}
for f in frames/screenshot-*.html; do n=${f:t:r}; render ${f:t} 1280 800 ${n#screenshot-}.png; done
render promo-small.html 440 280 promo-small-440x280.png
render promo-marquee.html 1400 560 promo-marquee-1400x560.png
ab close >/dev/null
