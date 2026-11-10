import { applyPreset, mergeVfsObjects, CROSS_PLATFORM_PRESET } from './crossPlatform';

describe('cross-platform preset', () => {
  it('adds the Apple modules without dropping existing ones', () => {
    expect(mergeVfsObjects('')).toBe('fruit streams_xattr');
    expect(mergeVfsObjects('acl_xattr')).toBe('acl_xattr fruit streams_xattr');
    expect(mergeVfsObjects('fruit catia')).toBe('fruit catia streams_xattr');
  });

  it('keeps unrelated global settings and applies the preset', () => {
    const out = applyPreset({ workgroup: 'HOME', 'server min protocol': 'NT1' });
    expect(out.workgroup).toBe('HOME');
    expect(out['server min protocol']).toBe('SMB2_10');
    Object.keys(CROSS_PLATFORM_PRESET).forEach((k) => expect(out[k]).toBe(CROSS_PLATFORM_PRESET[k]));
    expect(out['vfs objects']).toBe('fruit streams_xattr');
  });
});
