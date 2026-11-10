// Builds the commands/addresses a client needs to open a share.

const isIPv6 = (host) => host.includes(':');

/** Host name used in UNC paths: IPv6 literals need the .ipv6-literal.net trick on Windows. */
export const windowsHost = (host) =>
  isIPv6(host) ? `${host.replace(/:/g, '-').replace(/%/g, 's')}.ipv6-literal.net` : host;

export const connectInfo = (host, shareName) => {
  const urlHost = isIPv6(host) ? `[${host}]` : host;
  const mountPoint = `/mnt/${shareName.replace(/[^A-Za-z0-9_-]+/g, '_').toLowerCase()}`;
  return {
    windows: `\\\\${windowsHost(host)}\\${shareName}`,
    mac: `smb://${urlHost}/${encodeURIComponent(shareName)}`,
    linuxFiles: `smb://${urlHost}/${encodeURIComponent(shareName)}`,
    linuxMount: [
      `sudo mkdir -p ${mountPoint}`,
      `sudo mount -t cifs "//${host}/${shareName}" ${mountPoint} -o username=YOUR_USER,uid=$(id -u),gid=$(id -g)`,
    ].join('\n'),
    windowsNetUse: `net use Z: "\\\\${windowsHost(host)}\\${shareName}" /user:YOUR_USER *`,
  };
};

/** True when the page was opened through an address other clients cannot use. */
export const isLocalHost = (host) => ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host);
