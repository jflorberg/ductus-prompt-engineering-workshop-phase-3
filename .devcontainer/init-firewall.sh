#!/bin/bash
# Default-deny egress firewall for the dev container.
# Only DNS, SSH, the host network and the domains below are reachable.
set -euo pipefail
IFS=$'\n\t'

ALLOWED_DOMAINS=(
  registry.npmjs.org
  api.anthropic.com
  claude.ai
  console.anthropic.com
  statsig.anthropic.com
  sentry.io
  marketplace.visualstudio.com
  vscode.blob.core.windows.net
  update.code.visualstudio.com
)

# Keep Docker's internal DNS rules before flushing
DOCKER_DNS_RULES=$(iptables-save -t nat | grep "127\.0\.0\.11" || true)

iptables -F; iptables -X
iptables -t nat -F; iptables -t nat -X
iptables -t mangle -F; iptables -t mangle -X
ipset destroy allowed-domains 2>/dev/null || true

if [ -n "$DOCKER_DNS_RULES" ]; then
  iptables -t nat -N DOCKER_OUTPUT 2>/dev/null || true
  iptables -t nat -N DOCKER_POSTROUTING 2>/dev/null || true
  echo "$DOCKER_DNS_RULES" | xargs -L 1 iptables -t nat
fi

# DNS, SSH and localhost
iptables -A OUTPUT -p udp --dport 53 -j ACCEPT
iptables -A INPUT -p udp --sport 53 -j ACCEPT
iptables -A OUTPUT -p tcp --dport 22 -j ACCEPT
iptables -A INPUT -p tcp --sport 22 -m state --state ESTABLISHED -j ACCEPT
iptables -A INPUT -i lo -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT

ipset create allowed-domains hash:net

# GitHub publishes its IP ranges
echo "Fetching GitHub IP ranges"
gh_ranges=$(curl -fsS https://api.github.com/meta)
echo "$gh_ranges" | jq -r '(.web + .api + .git)[]' | grep -v ':' | aggregate -q | while read -r cidr; do
  ipset add allowed-domains "$cidr" -exist
done

for domain in "${ALLOWED_DOMAINS[@]}"; do
  echo "Resolving $domain"
  ips=$(dig +short A "$domain" | grep -E '^[0-9.]+$' || true)
  if [ -z "$ips" ]; then
    echo "WARNING: could not resolve $domain" >&2
    continue
  fi
  while read -r ip; do
    ipset add allowed-domains "$ip" -exist
  done <<< "$ips"
done

# Host network (VS Code port forwarding and the Docker host)
HOST_NETWORK=$(ip route | awk '/default/ {print $3}' | sed 's/\.[0-9]*$/.0\/24/')
iptables -A INPUT -s "$HOST_NETWORK" -j ACCEPT
iptables -A OUTPUT -d "$HOST_NETWORK" -j ACCEPT

# Default deny, allow established traffic and the allow list
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT DROP
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -m set --match-set allowed-domains dst -j ACCEPT
iptables -A OUTPUT -j REJECT --reject-with icmp-admin-prohibited

# Verify
if curl --connect-timeout 5 -fsS https://example.com >/dev/null 2>&1; then
  echo "ERROR: firewall check failed, example.com is reachable" >&2
  exit 1
fi
curl --connect-timeout 5 -fsS https://api.github.com/zen >/dev/null
echo "Firewall active: example.com blocked, api.github.com reachable"
