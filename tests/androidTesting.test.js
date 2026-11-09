const { test, expect } = require('@jest/globals');
const withAndroidTesting = require('../config-plugins/withAndroidTesting');

// Captured output of the original plugin before the release CMake fix.
const previousGeneratedBlock = `// Route Builder standalone testing variant
android {
    buildTypes {
        standaloneDebug {
            initWith release
            matchingFallbacks = ['release']
            signingConfig signingConfigs.debug
            debuggable false
        }
    }
}
`;

async function regenerateBuildGradle(contents) {
  const config = withAndroidTesting({ name: 'Fixture', slug: 'fixture' });
  const result = await config.mods.android.appBuildGradle({
    ...config,
    modResults: { language: 'groovy', contents },
    modRequest: {
      projectRoot: '/fixture',
      platformProjectRoot: '/fixture/android',
      platform: 'android',
      modName: 'appBuildGradle',
    },
  });
  return result.modResults.contents;
}

test('updates an existing standalone variant to release CMake and remains single on regeneration', async () => {
  const original = `// Preserve unrelated native settings\nandroid { namespace 'com.example.fixture' }\n${previousGeneratedBlock}`;
  const first = await regenerateBuildGradle(original);
  expect(first.match(/standaloneDebug\s*\{/g)).toHaveLength(1);
  expect(first).toContain('arguments "-DCMAKE_BUILD_TYPE=Release"');
  expect(first).toContain("android { namespace 'com.example.fixture' }");
  expect(first).toContain('debuggable false');
  expect(first).toContain('signingConfig signingConfigs.debug');
  const second = await regenerateBuildGradle(first);
  expect(second).toBe(first);
});

test('keeps generated base splash resources usable below Android 13', async () => {
  const config = withAndroidTesting({
    name: 'Fixture',
    slug: 'fixture',
    mods: { android: { styles: async (mod) => mod } },
  });
  const result = await config.mods.android.styles({
    ...config,
    modResults: {
      resources: {
        style: [
          {
            $: { name: 'Theme.App.SplashScreen', parent: 'Theme.SplashScreen' },
            item: [
              { $: { name: 'windowSplashScreenBackground' }, _: '@color/splashscreen_background' },
              { $: { name: 'android:windowSplashScreenBehavior' }, _: 'icon_preferred' },
            ],
          },
        ],
      },
    },
    modRequest: { platform: 'android', modName: 'styles' },
  });
  const items = result.modResults.resources.style[0].item;
  expect(items.map((item) => item.$.name)).not.toContain('android:windowSplashScreenBehavior');
  expect(items).toContainEqual({
    $: { name: 'windowSplashScreenBackground' },
    _: '@color/splashscreen_background',
  });
});
