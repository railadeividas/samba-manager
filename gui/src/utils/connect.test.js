import { connectInfo, isLocalHost, windowsHost } from './connect';

describe('connectInfo', () => {
  it('builds a Windows UNC path and a macOS/Linux smb:// URL', () => {
    const info = connectInfo('nas.local', 'team docs');
    expect(info.windows).toBe('\\\\nas.local\\team docs');
    expect(info.mac).toBe('smb://nas.local/team%20docs');
    expect(info.linuxFiles).toBe(info.mac);
  });

  it('builds a safe mount command', () => {
    const info = connectInfo('192.168.1.10', 'Team Docs!');
    expect(info.linuxMount).toContain('sudo mount -t cifs "//192.168.1.10/Team Docs!" /mnt/team_docs_');
    expect(info.linuxMount).toContain('uid=$(id -u)');
  });

  it('handles IPv6 literals', () => {
    expect(windowsHost('fe80::1')).toBe('fe80--1.ipv6-literal.net');
    expect(connectInfo('fe80::1', 'x').mac).toBe('smb://[fe80::1]/x');
  });

  it('detects loopback addresses', () => {
    expect(isLocalHost('localhost')).toBe(true);
    expect(isLocalHost('192.168.1.5')).toBe(false);
  });
});
