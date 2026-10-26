FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive \
    COREPACK_HOME=/opt/corepack \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ARG NODE_VERSION=22.23.4

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        git \
        gnupg \
        sudo \
        xz-utils \
    && rm -rf /var/lib/apt/lists/*

# Node and pnpm land on the default PATH. Login shells do not source ~/.bashrc.
RUN curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt" -o /tmp/SHASUMS256.txt \
    && curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" -o "/tmp/node-v${NODE_VERSION}-linux-x64.tar.xz" \
    && grep "node-v${NODE_VERSION}-linux-x64.tar.xz" /tmp/SHASUMS256.txt | (cd /tmp && sha256sum -c -) \
    && tar -xJf "/tmp/node-v${NODE_VERSION}-linux-x64.tar.xz" -C /usr/local --strip-components=1 --no-same-owner \
    && rm -f "/tmp/node-v${NODE_VERSION}-linux-x64.tar.xz" /tmp/SHASUMS256.txt \
    && mkdir -p /opt/corepack \
    && corepack enable \
    && corepack prepare pnpm@12.15.0 --activate \
    && pnpm -v \
    && chown -R ubuntu:ubuntu /opt/corepack

# Docker-in-Docker for the local compose stack. Versions were installed successfully
# on Ubuntu 24.04 in a nested Cloud Agent VM. fuse-overlayfs and iptables-legacy
# are required because the agent VM is itself a container.
RUN install -m 0755 -d /etc/apt/keyrings \
    && curl --retry 3 --retry-delay 5 -fsSL https://download.docker.com/linux/ubuntu/gpg \
        | gpg --batch --yes --dearmor -o /etc/apt/keyrings/docker.gpg \
    && chmod a+r /etc/apt/keyrings/docker.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu noble stable" \
        > /etc/apt/sources.list.d/docker.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
        -o Dpkg::Options::="--force-confdef" \
        -o Dpkg::Options::="--force-confold" \
        docker-ce=5:29.9.2-1~ubuntu.24.04~noble \
        docker-ce-cli=5:29.9.2-1~ubuntu.24.04~noble \
        containerd.io=2.4.2-3~ubuntu.24.04~noble \
        docker-buildx-plugin=0.38.1-1~ubuntu.24.04~noble \
        docker-compose-plugin=5.6.1-1~ubuntu.24.04~noble \
        fuse-overlayfs \
        iptables \
    && rm -rf /var/lib/apt/lists/* \
    && update-alternatives --set iptables /usr/sbin/iptables-legacy \
    && update-alternatives --set ip6tables /usr/sbin/ip6tables-legacy \
    && mkdir -p /etc/docker \
    && printf '%s\n' \
        '{' \
        '  "storage-driver": "fuse-overlayfs",' \
        '  "features": {' \
        '    "containerd-snapshotter": false' \
        '  }' \
        '}' > /etc/docker/daemon.json \
    && groupadd -f docker \
    && usermod -aG docker ubuntu \
    && echo "ubuntu ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/ubuntu \
    && chmod 440 /etc/sudoers.d/ubuntu

USER ubuntu
WORKDIR /workspace
