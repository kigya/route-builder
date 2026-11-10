const { test, expect } = require('@jest/globals');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

test('Router JavaScript and Android autolinking use the same Screens package', () => {
  // Run the real Node resolver and autolinker outside Jest's resolver/mocks.
  const output = execFileSync(
    process.execPath,
    [
      '-e',
      `
    const path = require('node:path');
    const { execFileSync } = require('node:child_process');
    const routerRoot = path.dirname(require.resolve('expo-router/package.json'));
    const javascriptRoot = path.dirname(require.resolve('react-native-screens/package.json', { paths: [routerRoot] }));
    const autolinker = path.join(path.dirname(require.resolve('expo-modules-autolinking/package.json')), 'bin/expo-modules-autolinking.js');
    const nativeConfig = JSON.parse(execFileSync(process.execPath, [autolinker, 'react-native-config', '--platform', 'android', '--json'], { encoding: 'utf8' }));
    process.stdout.write(JSON.stringify({ javascriptRoot, nativeRoot: nativeConfig.dependencies['react-native-screens'].root }));
  `,
    ],
    { cwd: path.dirname(require.resolve('../package.json')), encoding: 'utf8' }
  );
  const resolution = JSON.parse(output);
  expect(resolution.javascriptRoot).toBe(resolution.nativeRoot);
});
