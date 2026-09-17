FROM ubuntu:26.04

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

ENV DEBIAN_FRONTEND=noninteractive \
    CARGO_BUILD_JOBS=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential ca-certificates curl git libssl-dev pkg-config python3 unzip xz-utils \
    && rm -rf /var/lib/apt/lists/* \
    && if id ubuntu >/dev/null 2>&1; then userdel -r ubuntu; fi \
    && groupadd --gid 1000 vscode \
    && useradd --uid 1000 --gid 1000 --create-home --shell /bin/bash vscode

COPY package.json engine/rust-toolchain.toml /tmp/toolchain/
COPY .devcontainer/install-tools.sh /tmp/install-tools.sh

USER vscode
ENV HOME=/home/vscode \
    BUN_INSTALL=/home/vscode/.bun \
    CARGO_HOME=/home/vscode/.cargo \
    RUSTUP_HOME=/home/vscode/.rustup
ENV PATH="${BUN_INSTALL}/bin:${CARGO_HOME}/bin:${PATH}"

RUN bash /tmp/install-tools.sh

USER root
RUN rm -rf /tmp/toolchain /tmp/install-tools.sh
USER vscode
WORKDIR /workspaces/human-atlas
