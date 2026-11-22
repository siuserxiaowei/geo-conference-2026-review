#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SOURCES_DIR="$ROOT_DIR/sources"
mkdir -p "$SOURCES_DIR"

fetch_doc() {
  local token="$1"
  local outfile="$2"
  local attempt=1
  local max_attempts=3

  while [ "$attempt" -le "$max_attempts" ]; do
    echo "[$outfile] Fetching $token (attempt $attempt/$max_attempts)..."
    local tmp_json
    tmp_json="$(mktemp)"
    if lark-cli docs +fetch --as user --doc "$token" --doc-format markdown > "$tmp_json" 2>&1; then
      if python3 - "$tmp_json" "$outfile" <<'PY'
import sys, json
raw_path, out_path = sys.argv[1], sys.argv[2]
with open(raw_path, 'r', encoding='utf-8') as f:
    data = json.load(f)
if not data.get('ok'):
    print("API error:", json.dumps(data, ensure_ascii=False)[:300], file=sys.stderr)
    sys.exit(1)
content = data['data']['document']['content']
if not content.strip():
    print("Empty content", file=sys.stderr)
    sys.exit(1)
with open(out_path, 'w', encoding='utf-8') as f:
    f.write(content)
PY
      then
        rm -f "$tmp_json"
        echo "[$outfile] OK ($(wc -m < "$outfile" | tr -d ' ') chars)"
        return 0
      fi
    fi
    rm -f "$tmp_json"
    if [ "$attempt" -lt "$max_attempts" ]; then
      echo "[$outfile] Failed, retrying in 3s..." >&2
      sleep 3
    fi
    attempt=$((attempt + 1))
  done

  echo "[$outfile] ERROR: Failed after $max_attempts attempts" >&2
  return 1
}

fetch_doc "CdkadcJfEoNc0OxOIiQcNzapn4e" "$SOURCES_DIR/s1-minutes.md"
fetch_doc "REv7dMEF6oJSXtxav0JcueR0n3b" "$SOURCES_DIR/s1-transcript.md"
fetch_doc "P47ad7fHmoJFSHxIr8qcEgXLnzh" "$SOURCES_DIR/s2-minutes.md"
fetch_doc "ImlGdGD3xolJBexdWTBcIdq9nlU" "$SOURCES_DIR/s2-transcript.md"
fetch_doc "NdcMdyxBboHbpwxEyZPcT1xDnEg" "$SOURCES_DIR/s3-minutes.md"
fetch_doc "YfUmdjeHDoxnHKxBsWbc10yenSd" "$SOURCES_DIR/s3-transcript.md"
fetch_doc "NZswdB8ygoIrrRxjQOdc4eI4nPh" "$SOURCES_DIR/s4-minutes.md"
fetch_doc "DTYJdnzhYo9kruxcp8vcMhQQnKg" "$SOURCES_DIR/s4-transcript.md"
fetch_doc "EOA5dfY1Ro2SfGxjxoZcZpCynac" "$SOURCES_DIR/s4-yanggang-minutes.md"
fetch_doc "G2G3dPI2ao714TxROTNcYJjvnwm" "$SOURCES_DIR/s5-minutes.md"
fetch_doc "RCRUdcnQvo1tgexiW5Dc9LounFn" "$SOURCES_DIR/s5-transcript.md"
fetch_doc "Gl1UdY2seoGhGpxDbyZcE9w8nfc" "$SOURCES_DIR/s6-minutes.md"
fetch_doc "KSaJd0dXgo07mhx42w1cFftNnvg" "$SOURCES_DIR/s6-transcript.md"
fetch_doc "GkwIdOrcso9r9dxA3X2cToU4nbd" "$SOURCES_DIR/s7-minutes.md"
fetch_doc "Tzp5djKfToe6HMxAe1LcPoCcnmh" "$SOURCES_DIR/s7-transcript.md"

echo "All sources fetched successfully."
