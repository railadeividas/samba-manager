/**
 * Comprehensive list of Samba parameters organized by section
 * This file contains common parameters and their descriptions for different Samba configuration sections
 * This is the central source for all parameter information used throughout the application
 */

// Parameter descriptions with values as objects containing description and possible values
export const parameterDescriptions = {
  // Global parameters
  'workgroup': {
    description: 'NT domain name or workgroup name',
    examples: ['WORKGROUP', 'MYDOMAIN']
  },
  'server string': {
    description: 'Descriptive text about the server',
    examples: ['Samba Server', '%h server (Samba, Ubuntu)']
  },
  'netbios name': {
    description: 'The NetBIOS name of this server',
    examples: ['MYSERVER', 'FILESERVER']
  },
  'security': {
    description: 'Security mode (user, domain, ads)',
    examples: ['user', 'domain', 'ads']
  },
  'map to guest': {
    description: 'Mapping to guest account (never, bad user, bad password)',
    examples: ['never', 'bad user', 'bad password']
  },
  'dns proxy': {
    description: 'Whether to host NetBIOS names via DNS',
    examples: ['yes', 'no']
  },
  'log file': {
    description: 'Path to log file',
    examples: ['/var/log/samba/log.%m', '/var/log/samba/samba.log']
  },
  'max log size': {
    description: 'Maximum size of log file in KB',
    examples: ['1000', '5000']
  },
  'log level': {
    description: 'Logging verbosity (0-10)',
    examples: ['0', '1', '2', '3']
  },
  'client min protocol': {
    description: 'Minimum SMB protocol version (SMB1, SMB2, SMB3)',
    examples: ['NT1', 'SMB2', 'SMB3']
  },
  'client max protocol': {
    description: 'Maximum SMB protocol version (SMB1, SMB2, SMB3)',
    examples: ['NT1', 'SMB2', 'SMB3']
  },
  'server min protocol': {
    description: 'Minimum SMB protocol version for server',
    examples: ['NT1', 'SMB2', 'SMB3']
  },
  'server max protocol': {
    description: 'Maximum SMB protocol version for server',
    examples: ['NT1', 'SMB2', 'SMB3']
  },
  'passdb backend': {
    description: 'Password database backend (tdbsam, smbpasswd)',
    examples: ['tdbsam', 'smbpasswd']
  },
  'printing': {
    description: 'Printing configuration (bsd, sysv, cups)',
    examples: ['bsd', 'sysv', 'cups']
  },
  'printcap name': {
    description: 'Printcap file path or print system name',
    examples: ['/etc/printcap', 'cups']
  },
  'load printers': {
    description: 'Whether to load printers automatically',
    examples: ['yes', 'no']
  },
  'encrypt passwords': {
    description: 'Whether to use encrypted passwords',
    examples: ['yes', 'no']
  },
  'wins support': {
    description: 'Whether this server acts as a WINS server',
    examples: ['yes', 'no']
  },
  'wins server': {
    description: 'IP address of WINS server',
    examples: ['192.168.1.100', '10.0.0.10']
  },
  'name resolve order': {
    description: 'Name resolution order (bcast, lmhosts, host, wins)',
    examples: ['lmhosts host wins bcast', 'host wins bcast']
  },
  'interfaces': {
    description: 'Network interfaces Samba should use',
    examples: ['eth0', '192.168.1.0/24', 'lo eth0']
  },
  'bind interfaces only': {
    description: 'Only bind to interfaces in the interfaces list',
    examples: ['yes', 'no']
  },
  'hosts allow': {
    description: 'Hosts allowed to connect to Samba',
    examples: ['192.168.1.', '10.0.0.0/24', 'localhost']
  },
  'hosts deny': {
    description: 'Hosts denied from connecting to Samba',
    examples: ['192.168.1.100', 'all']
  },
  'deadtime': {
    description: 'Disconnection time for inactive connections in minutes',
    examples: ['10', '30']
  },
  'idmap config': {
    description: 'Identity mapping configuration',
    examples: ['* : backend = tdb', '* : range = 10000-20000']
  },
  'template shell': {
    description: 'Default shell for users',
    examples: ['/bin/bash', '/bin/false']
  },
  'usershare allow guests': {
    description: 'Allow guest access to user shares',
    examples: ['yes', 'no']
  },
  'usershare max shares': {
    description: 'Maximum number of user-defined shares',
    examples: ['100', '10']
  },
  'usershare owner only': {
    description: 'Only share owners can define user shares',
    examples: ['yes', 'no']
  },
  'usershare path': {
    description: 'Path to store user share definitions',
    examples: ['/var/lib/samba/usershares', '/etc/samba/shares']
  },
  'winbind enum users': {
    description: 'Allow user enumeration via Winbind',
    examples: ['yes', 'no']
  },
  'winbind enum groups': {
    description: 'Allow group enumeration via Winbind',
    examples: ['yes', 'no']
  },
  'realm': {
    description: 'Active Directory realm or domain',
    examples: ['EXAMPLE.COM', 'AD.DOMAIN.COM']
  },
  'socket options': {
    description: 'Socket options for performance tuning',
    examples: ['TCP_NODELAY IPTOS_LOWDELAY', 'SO_KEEPALIVE']
  },
  'use sendfile': {
    description: 'Use the sendfile() system call for file transfers',
    examples: ['yes', 'no']
  },
  'aio read size': {
    description: 'Size of blocks for asynchronous read operations',
    examples: ['1024', '4096']
  },
  'aio write size': {
    description: 'Size of blocks for asynchronous write operations',
    examples: ['1024', '4096']
  },
  'smb encrypt': {
    description: 'SMB encryption requirements (auto, desired, required, off)',
    examples: ['auto', 'desired', 'required', 'off']
  },
  'dns forwarder': {
    description: 'DNS server for WINS lookups',
    examples: ['192.168.1.1', '8.8.8.8']
  },
  'disable netbios': {
    description: 'Disable NetBIOS over TCP/IP',
    examples: ['yes', 'no']
  },
  'enable core files': {
    description: 'Whether to create core files on crashes',
    examples: ['yes', 'no']
  },
  'max connections': {
    description: 'Maximum number of connections',
    examples: ['100', '500']
  },
  'unix password sync': {
    description: 'Synchronize Unix password with SMB password',
    examples: ['yes', 'no']
  },
  'pam password change': {
    description: 'Use PAM for password changes',
    examples: ['yes', 'no']
  },
  'username map': {
    description: 'File containing username mapping',
    examples: ['/etc/samba/smbusers', '/etc/samba/user.map']
  },

  // Common parameters for shares
  'comment': {
    description: 'Descriptive text about the share',
    examples: ['Data share', 'Home directories']
  },
  'path': {
    description: 'Path to the share directory',
    examples: ['/srv/samba/share', '/home/%U']
  },
  'browseable': {
    description: 'Whether the share is visible in network browsing',
    examples: ['yes', 'no']
  },
  'browsable': {
    description: 'Whether the share is visible in network browsing (alias for browseable)',
    examples: ['yes', 'no']
  },
  'read only': {
    description: 'Whether the share is read-only',
    examples: ['yes', 'no']
  },
  'writable': {
    description: 'Whether the share is writable (opposite of read only)',
    examples: ['yes', 'no']
  },
  'writeable': {
    description: 'Whether the share is writable (alias for writable)',
    examples: ['yes', 'no']
  },
  'create mask': {
    description: 'File creation mask',
    examples: ['0644', '0664', '0755']
  },
  'directory mask': {
    description: 'Directory creation mask',
    examples: ['0755', '0775']
  },
  'force create mode': {
    description: 'Force bits to be set when a file is created',
    examples: ['0644', '0664']
  },
  'force directory mode': {
    description: 'Force bits to be set when a directory is created',
    examples: ['0755', '0775']
  },
  'valid users': {
    description: 'List of users allowed to access the share',
    examples: ['user1 user2', '@group1', '%S', '%U']
  },
  'guest ok': {
    description: 'Whether guest access is allowed',
    examples: ['yes', 'no']
  },
  'guest only': {
    description: 'Only allow guest access',
    examples: ['yes', 'no']
  },
  'follow symlinks': {
    description: 'Whether to follow symbolic links',
    examples: ['yes', 'no']
  },
  'wide links': {
    description: 'Whether to allow links outside the share',
    examples: ['yes', 'no']
  },
  'hide dot files': {
    description: 'Whether to hide dot files',
    examples: ['yes', 'no']
  },
  'hide files': {
    description: 'Pattern for files to hide',
    examples: ['/.*/', '*.bak']
  },
  'veto files': {
    description: 'Pattern for files to deny access to',
    examples: ['/*.exe/*.com/*.dll/', '*.mp3']
  },
  'force user': {
    description: 'Force files to be created with the specified user',
    examples: ['nobody', 'www-data']
  },
  'force group': {
    description: 'Force files to be created with the specified group',
    examples: ['nogroup', 'www-data']
  },
  'hide unreadable': {
    description: 'Hide files the user has no read access to',
    examples: ['yes', 'no']
  },
  'inherit permissions': {
    description: 'New files and directories inherit permissions from parent directory',
    examples: ['yes', 'no']
  },
  'map archive': {
    description: 'Map DOS archive bit to Unix user execute bit',
    examples: ['yes', 'no']
  },
  'map readonly': {
    description: 'Map DOS readonly bit to Unix read-only bit',
    examples: ['yes', 'no']
  },
  'map system': {
    description: 'Map DOS system bit to Unix group execute bit',
    examples: ['yes', 'no']
  },
  'oplocks': {
    description: 'Enable opportunistic locks',
    examples: ['yes', 'no']
  },
  'default case': {
    description: 'Default case for filenames (lower, upper)',
    examples: ['lower', 'upper']
  },
  'case sensitive': {
    description: 'Whether filenames are case sensitive',
    examples: ['yes', 'no']
  },
  'ea support': {
    description: 'Enable extended attributes',
    examples: ['yes', 'no']
  },
  'nt acl support': {
    description: 'Enable NT ACL support',
    examples: ['yes', 'no']
  },
  'store dos attributes': {
    description: 'Store DOS attributes in extended attributes',
    examples: ['yes', 'no']
  },
  'strict allocate': {
    description: 'Pre-allocate space for files',
    examples: ['yes', 'no']
  },
  'vfs objects': {
    description: 'VFS modules to use',
    examples: ['recycle', 'shadow_copy2']
  },
  'unix extensions': {
    description: 'Enable Unix extensions',
    examples: ['yes', 'no']
  },

  // Printers parameters
  'printable': {
    description: 'Whether printing is enabled',
    examples: ['yes', 'no']
  },
  'print ok': {
    description: 'Whether printing is enabled (alias for printable)',
    examples: ['yes', 'no']
  },
  'printer admin': {
    description: 'Users who can administer this printer',
    examples: ['root', 'admin @ntadmins']
  },
  'printer name': {
    description: 'Name of the printer in the printing subsystem',
    examples: ['HP1', 'Canon-Office']
  },
  'use client driver': {
    description: 'Whether to use client-side printer drivers',
    examples: ['yes', 'no']
  },
  'default devmode': {
    description: 'Whether to use default device mode',
    examples: ['yes', 'no']
  },
  'force printername': {
    description: 'Force the use of a specific printer name',
    examples: ['yes', 'no']
  },
  'print command': {
    description: 'Command to execute when printing a file',
    examples: ['lpr -P%p %s', 'lp -d%p %s']
  },
  'lpq command': {
    description: 'Command to get printer queue status',
    examples: ['lpq -P%p', 'lpstat -o%p']
  },
  'lprm command': {
    description: 'Command to remove a print job',
    examples: ['lprm -P%p %j', 'cancel %p-%j']
  },
  'lppause command': {
    description: 'Command to pause a print job',
    examples: ['lp -i %p-%j -H hold', 'lpc hold %p %j']
  },
  'lpresume command': {
    description: 'Command to resume a print job',
    examples: ['lp -i %p-%j -H resume', 'lpc release %p %j']
  },
  'queuepause command': {
    description: 'Command to pause a print queue',
    examples: ['lpc hold %p', 'disable %p']
  },
  'queueresume command': {
    description: 'Command to resume a print queue',
    examples: ['lpc release %p', 'enable %p']
  },

  // Print$ section
  'write list': {
    description: 'Users who can write to this share',
    examples: ['root', '@admin']
  },
  'admin users': {
    description: 'Users who have admin privileges on this share',
    examples: ['root', '@admin']
  }
};

// Global parameters (applicable to the [global] section)
export const globalParameters = [
  'workgroup',
  'server string',
  'netbios name',
  'security',
  'map to guest',
  'dns proxy',
  'log file',
  'max log size',
  'log level',
  'client min protocol',
  'client max protocol',
  'server min protocol',
  'server max protocol',
  'passdb backend',
  'printing',
  'printcap name',
  'load printers',
  'encrypt passwords',
  'wins support',
  'wins server',
  'name resolve order',
  'interfaces',
  'bind interfaces only',
  'hosts allow',
  'hosts deny',
  'deadtime',
  'idmap config',
  'template shell',
  'usershare allow guests',
  'usershare max shares',
  'usershare owner only',
  'usershare path',
  'winbind enum users',
  'winbind enum groups',
  'realm',
  'socket options',
  'use sendfile',
  'aio read size',
  'aio write size',
  'smb encrypt',
  'dns forwarder',
  'disable netbios',
  'enable core files',
  'max connections',
  'unix password sync',
  'pam password change',
  'username map'
];

// Homes section parameters (applicable to the [homes] section)
export const homesParameters = [
  'browsable',
  'browseable',
  'read only',
  'create mask',
  'directory mask',
  'valid users',
  'comment',
  'path',
  'guest ok',
  'writable',
  'writeable',
  'follow symlinks',
  'wide links',
  'hide dot files',
  'force create mode',
  'force directory mode',
  'hide files',
  'veto files',
  'force user',
  'force group',
  'hosts allow',
  'hosts deny',
  'hide unreadable',
  'inherit permissions',
  'map archive',
  'map readonly',
  'map system',
  'oplocks',
  'default case',
  'case sensitive',
  'ea support',
  'nt acl support',
  'store dos attributes',
  'strict allocate',
  'vfs objects',
  'unix extensions'
];

// Printers section parameters (applicable to the [printers] section)
export const printersParameters = [
  'comment',
  'path',
  'browseable',
  'browsable',
  'guest ok',
  'printable',
  'print ok',
  'printer admin',
  'printer name',
  'use client driver',
  'default devmode',
  'force printername',
  'printing',
  'print command',
  'lpq command',
  'lprm command',
  'lppause command',
  'lpresume command',
  'queuepause command',
  'queueresume command',
  'valid users',
  'create mask',
  'directory mask',
  'hide files',
  'veto files',
  'hosts allow',
  'hosts deny'
];

// Print$ section parameters (applicable to the [print$] section)
export const printDriversParameters = [
  'comment',
  'path',
  'browseable',
  'browsable',
  'read only',
  'write list',
  'create mask',
  'directory mask',
  'force create mode',
  'force directory mode',
  'guest ok',
  'valid users',
  'admin users',
  'hide files',
  'veto files',
  'hosts allow',
  'hosts deny',
  'force user',
  'force group'
];

/**
 * Get parameter description object
 * @param {string} param - Parameter name
 * @returns {Object|null} - Parameter description object or null if not found
 */
export const getParameterDescription = (param) => {
  return parameterDescriptions[param] || null;
};

/**
 * Get just the description text for a parameter
 * @param {string} param - Parameter name
 * @returns {string} - Description text or empty string if not found
 */
export const getParameterDescriptionText = (param) => {
  return parameterDescriptions[param]?.description || '';
};

/**
 * Get a mapping of parameter names to their description text
 * @param {Array} params - List of parameter names
 * @returns {Object} - Object with parameter names as keys and descriptions as values
 */
export const getParameterDescriptionsMap = (params = []) => {
  const map = {};

  if (params.length === 0) {
    // If no parameters specified, return all descriptions
    Object.keys(parameterDescriptions).forEach(param => {
      map[param] = parameterDescriptions[param].description;
    });
  } else {
    // Otherwise, return descriptions only for specified parameters
    params.forEach(param => {
      if (parameterDescriptions[param]) {
        map[param] = parameterDescriptions[param].description;
      }
    });
  }

  return map;
};

/**
 * Get parameters by section name
 * @param {string} sectionName - Name of the section
 * @returns {Array} - List of parameters for that section
 */
export const getParametersBySection = (sectionName) => {
  const section = sectionName.toLowerCase();

  switch (section) {
    case 'global':
      return globalParameters;
    case 'homes':
      return homesParameters;
    case 'printers':
      return printersParameters;
    case 'print$':
      return printDriversParameters;
    default:
      // For unknown sections, return a combination of common parameters
      return [
        ...new Set([
          'comment',
          'path',
          'browseable',
          'read only',
          'writable',
          'guest ok',
          'valid users',
          'create mask',
          'directory mask',
          'force create mode',
          'force directory mode',
          'veto files',
          'hide files',
          'hosts allow',
          'hosts deny',
          'force user',
          'force group'
        ])
      ];
  }
};

/**
 * Get descriptions for parameters in a specific section
 * @param {string} sectionName - Name of the section
 * @returns {Object} - Object with parameter names as keys and descriptions as values
 */
export const getDescriptionsBySection = (sectionName) => {
  const params = getParametersBySection(sectionName);
  return getParameterDescriptionsMap(params);
};

// Export a complete map for easy access
export const allSambaParameters = {
  global: globalParameters,
  homes: homesParameters,
  printers: printersParameters,
  'print$': printDriversParameters
};
