#!/usr/bin/env bash
set -euo pipefail

bun_version="$(python3 -c 'import json; print(json.load(open("/tmp/toolchain/package.json"))["packageManager"].split("@")[1])')"
rust_version="$(python3 -c 'import tomllib; print(tomllib.load(open("/tmp/toolchain/rust-toolchain.toml", "rb"))["toolchain"]["channel"])')"
wasm_pack_version=0.15.0
scratch="$(mktemp -d)"
trap 'rm -rf "$scratch"' EXIT

case "$(uname -m)" in
    x86_64)
        bun_target=linux-x64-baseline
        rust_target=x86_64-unknown-linux-musl
        ;;
    aarch64)
        bun_target=linux-aarch64
        rust_target=aarch64-unknown-linux-musl
        ;;
    *) printf 'Unsupported architecture: %s\n' "$(uname -m)" >&2; exit 1 ;;
esac

curl --fail --show-error --silent --location --retry 3 \
    "https://github.com/oven-sh/bun/releases/download/bun-v${bun_version}/bun-${bun_target}.zip" \
    --output "$scratch/bun.zip"
unzip -q "$scratch/bun.zip" -d "$scratch"
mkdir -p "$BUN_INSTALL/bin" "$CARGO_HOME/bin"
install -m 755 "$scratch/bun-${bun_target}/bun" "$BUN_INSTALL/bin/bun"
ln -s bun "$BUN_INSTALL/bin/bunx"

curl --fail --show-error --silent --location --retry 3 \
    https://sh.rustup.rs --output "$scratch/rustup.sh"
bash "$scratch/rustup.sh" -y --no-modify-path --profile minimal \
    --default-toolchain "$rust_version" \
    --component clippy --component rustfmt --target wasm32-unknown-unknown

curl --fail --show-error --silent --location --retry 3 \
    "https://github.com/wasm-bindgen/wasm-pack/releases/download/v${wasm_pack_version}/wasm-pack-v${wasm_pack_version}-${rust_target}.tar.gz" \
    --output "$scratch/wasm-pack.tar.gz"
tar -xzf "$scratch/wasm-pack.tar.gz" -C "$scratch"
install -m 755 "$scratch/wasm-pack-v${wasm_pack_version}-${rust_target}/wasm-pack" "$CARGO_HOME/bin/wasm-pack"

bun --version
rustc --version
wasm-pack --version
