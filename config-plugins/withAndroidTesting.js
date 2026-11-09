const {
  withAppBuildGradle,
  withAndroidManifest,
  withDangerousMod,
  withGradleProperties,
  withMainApplication,
  withBaseMod,
} = require('expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');

/** @param {import('expo/config').ExpoConfig} config @returns {import('expo/config').ExpoConfig} */
function withAndroidTesting(config) {
  // Run after the splash plugin's style mod. Its optional API 33-only override
  // is emitted into unqualified resources; use the supported system default.
  config = withBaseMod(config, {
    platform: 'android',
    mod: 'styles',
    async action({ modRequest: { nextMod, ...modRequest }, ...mod }) {
      const result = await nextMod({ ...mod, modRequest });
      for (const style of result.modResults.resources.style ?? []) {
        style.item = style.item?.filter(
          (item) => item.$.name !== 'android:windowSplashScreenBehavior'
        );
      }
      return result;
    },
  });
  config = withGradleProperties(config, (mod) => {
    mod.modResults = mod.modResults.filter((entry) => entry.key !== 'android.minSdkVersion');
    mod.modResults.push({ type: 'property', key: 'android.minSdkVersion', value: '26' });
    return mod;
  });
  config = withMainApplication(config, (mod) => {
    if (!mod.modResults.contents.includes('useDevSupport = BuildConfig.DEBUG')) {
      if (!mod.modResults.contents.includes('context = applicationContext,')) {
        throw new Error('Unsupported Expo MainApplication template: cannot configure dev support');
      }
      mod.modResults.contents = mod.modResults.contents.replace(
        'context = applicationContext,',
        'context = applicationContext,\n      useDevSupport = BuildConfig.DEBUG,'
      );
    }
    return mod;
  });
  config = withAndroidManifest(config, (mod) => {
    const application = mod.modResults.manifest.application?.[0];
    if (!application) throw new Error('Android manifest is missing its application');
    application.$['android:usesCleartextTraffic'] = 'false';
    application.$['android:supportsRtl'] = 'false';
    return mod;
  });
  config = withAppBuildGradle(config, (mod) => {
    // Upgrade the first plugin revision's unbounded block before inserting the
    // replaceable block. Match only that generated structure, leaving user DSL.
    mod.modResults.contents = mod.modResults.contents.replace(
      /\/\/ Route Builder standalone testing variant\nandroid \{\n    buildTypes \{\n        standaloneDebug \{[\s\S]*?\n        \}\n    \}\n\}\n?/,
      ''
    );
    const start = '// @generated begin route-builder-android-testing';
    const end = '// @generated end route-builder-android-testing';
    const block = `${start}
android {
    buildTypes {
        standaloneDebug {
            initWith release
            matchingFallbacks = ['release']
            signingConfig signingConfigs.debug
            debuggable false
            externalNativeBuild {
                cmake { arguments "-DCMAKE_BUILD_TYPE=Release" }
            }
        }
    }
}
${end}`;
    const startIndex = mod.modResults.contents.indexOf(start);
    if (startIndex === -1) {
      mod.modResults.contents += `\n${block}\n`;
    } else {
      const endIndex = mod.modResults.contents.indexOf(end, startIndex);
      if (endIndex === -1) throw new Error('Incomplete generated Android testing block');
      mod.modResults.contents =
        mod.modResults.contents.slice(0, startIndex) +
        block +
        mod.modResults.contents.slice(endIndex + end.length);
    }
    return mod;
  });
  return withDangerousMod(config, [
    'android',
    async (mod) => {
      // The normal debug manifest also gets an explicit denial: only the standalone
      // USB testing variant may use the local HTTP mock.
      for (const [variant, allowed] of [
        ['debug', false],
        ['standaloneDebug', true],
      ]) {
        const directory = path.join(mod.modRequest.platformProjectRoot, 'app', 'src', variant);
        await fs.mkdir(directory, { recursive: true });
        await fs.writeFile(
          path.join(directory, 'AndroidManifest.xml'),
          `<manifest xmlns:android="http://schemas.android.com/apk/res/android" xmlns:tools="http://schemas.android.com/tools">
  <application android:usesCleartextTraffic="${allowed}" tools:replace="android:usesCleartextTraffic" />
</manifest>\n`
        );
      }
      return mod;
    },
  ]);
}
module.exports = withAndroidTesting;
