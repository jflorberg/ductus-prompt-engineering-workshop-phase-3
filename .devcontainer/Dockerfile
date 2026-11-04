FROM node:22-bookworm

# Tools for development and for the egress firewall (init-firewall.sh)
RUN apt-get update && apt-get install -y --no-install-recommends \
    git gh less procps sudo jq \
    iptables ipset iproute2 dnsutils aggregate ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

# Global npm packages go to a folder the non-root user owns
ENV NPM_CONFIG_PREFIX=/usr/local/share/npm-global
ENV PATH=$PATH:/usr/local/share/npm-global/bin
RUN mkdir -p /usr/local/share/npm-global /home/node/.claude \
  && chown -R node:node /usr/local/share/npm-global /home/node/.claude

# The firewall script is the only thing the node user may run as root
COPY init-firewall.sh /usr/local/bin/init-firewall.sh
RUN sed -i 's/\r$//' /usr/local/bin/init-firewall.sh \
  && chmod 755 /usr/local/bin/init-firewall.sh \
  && echo "node ALL=(root) NOPASSWD: /usr/local/bin/init-firewall.sh" > /etc/sudoers.d/node-firewall \
  && chmod 0440 /etc/sudoers.d/node-firewall

USER node
RUN npm install -g @anthropic-ai/claude-code

WORKDIR /workspaces
