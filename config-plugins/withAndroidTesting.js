const {
  withAppBuildGradle,
  withAndroidManifest,
  withDangerousMod,
  withGradleProperties,
  withMainApplication,
  withMainActivity,
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
    const imports = [
      'import com.facebook.react.modules.network.OkHttpClientProvider',
      'import okhttp3.RequestBody',
      'import okio.BufferedSink',
    ];
    for (const line of imports) {
      if (!mod.modResults.contents.includes(line)) {
        mod.modResults.contents = mod.modResults.contents.replace(
          /(package [^\n]+\n)/,
          `$1\n${line}\n`
        );
      }
    }
    const start = '    // @generated begin route-builder-network-policy';
    const end = '    // @generated end route-builder-network-policy';
    const networkPolicy = `${start}
    OkHttpClientProvider.setOkHttpClientFactory {
      OkHttpClientProvider.createClientBuilder(applicationContext)
        .retryOnConnectionFailure(false)
        .addInterceptor { chain ->
          val request = chain.request()
          val body = request.body
          // A POST body is one-shot: this also blocks HTTP 503/307/308 follow-ups.
          val guarded = if (request.method == "POST" && body != null) {
            request.newBuilder().method(request.method, object : RequestBody() {
              override fun contentType() = body.contentType()
              override fun contentLength() = body.contentLength()
              override fun isOneShot() = true
              override fun writeTo(sink: BufferedSink) = body.writeTo(sink)
            }).build()
          } else request
          chain.proceed(guarded)
        }
        .addNetworkInterceptor { chain ->
          val response = chain.proceed(chain.request())
          // Expose POST redirects to JavaScript instead of hiding the original
          // outcome behind a follow-up GET (301/302/303) or POST (307/308).
          if (chain.request().method == "POST" && response.code in 300..399) {
            response.newBuilder().removeHeader("Location").build()
          } else response
        }
        .build()
    }
${end}`;
    const existingStart = mod.modResults.contents.indexOf(start);
    if (existingStart !== -1) {
      const existingEnd = mod.modResults.contents.indexOf(end, existingStart);
      if (existingEnd === -1) throw new Error('Incomplete generated network policy');
      mod.modResults.contents =
        mod.modResults.contents.slice(0, existingStart) +
        networkPolicy +
        mod.modResults.contents.slice(existingEnd + end.length);
    } else {
      if (!mod.modResults.contents.includes('    super.onCreate()')) {
        throw new Error(
          'Unsupported MainApplication: cannot configure network policy before startup'
        );
      }
      mod.modResults.contents = mod.modResults.contents.replace(
        '    super.onCreate()',
        `    super.onCreate()\n${networkPolicy}`
      );
    }
    return mod;
  });
  config = withMainActivity(config, (mod) => {
    if (mod.modResults.language !== 'kt') throw new Error('Unsupported MainActivity language');
    let contents = mod.modResults.contents;
    const imports = [
      'import android.os.Build',
      'import android.graphics.Rect',
      'import android.view.View',
      'import android.view.ViewTreeObserver',
      'import android.view.WindowInsets',
      'import com.facebook.react.ReactApplication',
      'import com.facebook.react.bridge.Arguments',
      'import com.facebook.react.modules.core.DeviceEventManagerModule',
      'import com.facebook.react.uimanager.PixelUtil',
    ];
    for (const line of imports) {
      if (!contents.includes(line))
        contents = contents.replace(/(package [^\n]+\n)/, `$1\n${line}\n`);
    }
    const start = '  // @generated begin route-builder-keyboard-height';
    const end = '  // @generated end route-builder-keyboard-height';
    const previous = contents.indexOf(start);
    if (previous !== -1) {
      const previousEnd = contents.indexOf(end, previous);
      if (previousEnd === -1) throw new Error('Incomplete generated keyboard height observer');
      contents =
        contents.slice(0, previous) +
        contents.slice(
          previousEnd + end.length + (contents[previousEnd + end.length] === '\n' ? 1 : 0)
        );
    }
    if (contents.includes('override fun onDestroy'))
      throw new Error('Unsupported MainActivity onDestroy override');
    if (
      !contents.includes('  override fun onCreate') ||
      !contents.includes('super.onCreate(null)')
    ) {
      throw new Error('Unsupported MainActivity startup');
    }
    const observer = `${start}
  private var routeKeyboardObserver: ViewTreeObserver.OnGlobalLayoutListener? = null
  private var routeKeyboardDecor: View? = null
  private var routeKeyboardVisible = false
  private var routeKeyboardBottom = 0

  private fun observeRouteKeyboardHeight() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return
    val view = window.decorView
    routeKeyboardDecor = view
    val listener = ViewTreeObserver.OnGlobalLayoutListener {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        val insets = view.rootWindowInsets
        if (insets != null) {
          val visible = insets.isVisible(WindowInsets.Type.ime())
          val frame = Rect()
          view.getWindowVisibleDisplayFrame(frame)
          // RN 0.85 emits show/hide on API 30+, but misses an already-visible
          // IME changing height (for example the expanded emoji panel).
          if (visible && routeKeyboardVisible && frame.bottom != routeKeyboardBottom) {
            val context = (application as ReactApplication).reactHost?.currentReactContext
            if (context != null && context.hasActiveReactInstance()) {
              val height = insets.getInsets(WindowInsets.Type.ime()).bottom -
                insets.getInsets(WindowInsets.Type.systemBars()).bottom
              val coordinates = Arguments.createMap().apply {
                putDouble("screenY", PixelUtil.toDIPFromPixel(frame.bottom.toFloat()).toDouble())
                putDouble("screenX", PixelUtil.toDIPFromPixel(frame.left.toFloat()).toDouble())
                putDouble("width", PixelUtil.toDIPFromPixel(frame.width().toFloat()).toDouble())
                putDouble("height", PixelUtil.toDIPFromPixel(height.toFloat()).toDouble())
              }
              val event = Arguments.createMap().apply {
                putMap("endCoordinates", coordinates)
                putString("easing", "keyboard")
                putDouble("duration", 0.0)
              }
              context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("keyboardDidShow", event)
            }
          }
          routeKeyboardVisible = visible
          routeKeyboardBottom = frame.bottom
        }
      }
    }
    routeKeyboardObserver = listener
    view.viewTreeObserver.addOnGlobalLayoutListener(listener)
  }

  override fun onDestroy() {
    routeKeyboardObserver?.let { listener ->
      routeKeyboardDecor?.viewTreeObserver?.takeIf { it.isAlive }
        ?.removeOnGlobalLayoutListener(listener)
    }
    routeKeyboardObserver = null
    routeKeyboardDecor = null
    super.onDestroy()
  }
${end}`;
    contents = contents.replace('  override fun onCreate', `${observer}\n  override fun onCreate`);
    contents = contents.replace(
      /super\.onCreate\(null\)(?:\n    observeRouteKeyboardHeight\(\))?/,
      'super.onCreate(null)\n    observeRouteKeyboardHeight()'
    );
    mod.modResults.contents = contents;
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
