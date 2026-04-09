export function generateServerConfig(server, clients) {
  let config = `[Interface]
PrivateKey = ${server.privateKey}
Address = ${server.subnet}
ListenPort = ${server.listenPort}`;

  if (server.globalUseMtu && server.globalMtu) {
    config += `\nMTU = ${server.globalMtu}`;
  }

  if (server.enableNat) {
    const iface = server.natInterface || 'eth0';
    config += `\nPostUp = iptables -A FORWARD -i %i -j ACCEPT; iptables -t nat -A POSTROUTING -o ${iface} -j MASQUERADE`;
    config += `\nPostDown = iptables -D FORWARD -i %i -j ACCEPT; iptables -t nat -D POSTROUTING -o ${iface} -j MASQUERADE`;
  }
  config += `\n`;

  if (clients && clients.length > 0) {
    clients.forEach(client => {
      config += `\n# Client: ${client.name}
[Peer]
PublicKey = ${client.publicKey}`;
      if (client.presharedKey) {
        config += `\nPresharedKey = ${client.presharedKey}`;
      }
      config += `\nAllowedIPs = ${client.allowedIp}/32\n`;
    });
  }

  return config;
}

export function generateClientConfig(client, server) {
  let config = `[Interface]
PrivateKey = ${client.privateKey}
Address = ${client.allowedIp}/32`;

  if (client.useDns && client.dns) {
    config += `\nDNS = ${client.dns}`;
  }
  
  if (client.useMtu && client.mtu) {
    config += `\nMTU = ${client.mtu}`;
  }

  config += `

[Peer]
PublicKey = ${server.publicKey}`;

  if (client.presharedKey) {
    config += `\nPresharedKey = ${client.presharedKey}`;
  }

  config += `\nEndpoint = ${server.endpoint}:${server.listenPort}
AllowedIPs = ${client.routeAllowedIps || '0.0.0.0/0, ::/0'}
PersistentKeepalive = ${client.keepalive || '25'}
`;

  return config;
}
