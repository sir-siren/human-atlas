#!/usr/bin/env bash
set -euo pipefail

bun install --frozen-lockfile
bun scripts/build-engine.ts
