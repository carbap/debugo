#!/usr/bin/env bash
set -e

VERSIONS=(
    "0.16.1"    # Go 1.21 and 1.22
    "0.15.1"    # Go 1.18 and 1.19
    "0.13.0"    # Go 1.16 and 1.17
    # "0.9.21"    # Go 1.15 and 1.16
    # "0.9.19"    # Go 1.13 and 1.14
    # "0.8.0"     # Go 1.12 and 1.13
)

for v in "${VERSIONS[@]}"; do
  echo "Building Yaegi $v..."
  go125 mod edit -require=github.com/traefik/yaegi@v$v
  go125 mod tidy

  GOOS=js GOARCH=wasm go125 build -o yaegi-$v.wasm main.go
done

go125 mod edit -require=github.com/traefik/yaegi@v0.16.1
go125 mod tidy
