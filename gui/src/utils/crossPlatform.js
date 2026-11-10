// Global settings that make Windows, macOS (Finder) and Linux clients work well together.
export const CROSS_PLATFORM_PRESET = {
  'server min protocol': 'SMB2_10',
  'fruit:metadata': 'stream',
  'fruit:model': 'MacSamba',
  'fruit:posix_rename': 'yes',
  'fruit:veto_appledouble': 'no',
  'fruit:nfs_aces': 'no',
  'fruit:wipe_intentionally_left_blank_rfork': 'yes',
  'fruit:delete_empty_adfiles': 'yes',
};
const REQUIRED_VFS = ['fruit', 'streams_xattr'];

/** Adds the required VFS modules to an existing "vfs objects" list without dropping others. */
export const mergeVfsObjects = (existing) => {
  const current = (existing || '').split(/\s+/).filter(Boolean);
  const merged = [...current];
  REQUIRED_VFS.forEach((m) => { if (!merged.includes(m)) merged.push(m); });
  return merged.join(' ');
};

export const applyPreset = (globalConfig) => ({
  ...globalConfig,
  ...CROSS_PLATFORM_PRESET,
  'vfs objects': mergeVfsObjects(globalConfig['vfs objects']),
});

