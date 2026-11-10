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

async function regenerateMainApplication(contents) {
  const config = withAndroidTesting({ name: 'Fixture', slug: 'fixture' });
  const result = await config.mods.android.mainApplication({
    ...config,
    modResults: { language: 'kt', contents },
    modRequest: { platform: 'android', modName: 'mainApplication' },
  });
  return result.modResults.contents;
}

test('installs a non-retrying React Native network factory before native runtime startup and regenerates once', async () => {
  const original = `package com.example.fixture
import android.app.Application
class MainApplication : Application() {
  fun host() { initialize(context = applicationContext,) }
  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
    preserveUnrelatedInitialization()
  }
}`;
  const first = await regenerateMainApplication(original);
  expect(first).toContain('import com.facebook.react.modules.network.OkHttpClientProvider');
  expect(first).toContain('OkHttpClientProvider.createClientBuilder(applicationContext)');
  expect(first).toContain('.retryOnConnectionFailure(false)');
  expect(first).toContain('request.method == "POST"');
  expect(first).toContain('override fun isOneShot() = true');
  expect(first).toContain('.addNetworkInterceptor');
  expect(first).toContain('response.code in 300..399');
  expect(first).toContain('removeHeader("Location")');
  expect(first.indexOf('OkHttpClientProvider.setOkHttpClientFactory')).toBeLessThan(
    first.indexOf('loadReactNative(this)')
  );
  expect(first).toContain('preserveUnrelatedInitialization()');
  expect(first).toContain('useDevSupport = BuildConfig.DEBUG');
  expect(await regenerateMainApplication(first)).toBe(first);
});

async function regenerateMainActivity(contents) {
  const config = withAndroidTesting({ name: 'Fixture', slug: 'fixture' });
  const result = await config.mods.android.mainActivity({
    ...config,
    modResults: { language: 'kt', contents },
    modRequest: { platform: 'android', modName: 'mainActivity' },
  });
  return result.modResults.contents;
}

test('adds one activity-owned visible-IME height observer and releases it on destruction', async () => {
  const original = `package com.example.fixture
class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(null)
  }
  fun preserveDelegate() = true
}`;
  const first = await regenerateMainActivity(original);
  expect(first).toContain('viewTreeObserver.addOnGlobalLayoutListener');
  expect(first).toContain('visible && routeKeyboardVisible && frame.bottom != routeKeyboardBottom');
  expect(first).toContain('removeOnGlobalLayoutListener');
  expect(first).toContain('super.onCreate(null)\n    observeRouteKeyboardHeight()');
  expect(first).toContain('fun preserveDelegate() = true');
  expect(first.match(/override fun onDestroy/g)).toHaveLength(1);
  expect(await regenerateMainActivity(first)).toBe(first);
});
