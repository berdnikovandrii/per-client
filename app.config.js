// The static settings live in app.json. This file adds the Meta (Facebook / Instagram) SDK, which counts app
// installs that come from ads. Its two values are kept in the EAS environment, not in the repository:
//   META_APP_ID        the app's number in Meta for Developers
//   META_CLIENT_TOKEN  Settings → Advanced → Client token of the same app
// No "Allow tracking" prompt and no advertising ID: installs are counted through Apple's anonymous SKAdNetwork.
module.exports = ({ config }) => {
  const appID = process.env.META_APP_ID;
  const clientToken = process.env.META_CLIENT_TOKEN;
  if (!appID || !clientToken) {
    // The SDK is compiled into the iPhone app and stops it at launch when it has no app ID, so a store build
    // without the two values must not be made at all.
    if (process.env.EAS_BUILD === 'true' && process.env.EAS_BUILD_PLATFORM === 'ios') {
      throw new Error('META_APP_ID and META_CLIENT_TOKEN are not set in the EAS environment. Add them on expo.dev (Environment variables → production) and build again.');
    }
    return config;
  }
  return {
    ...config,
    extra: { ...config.extra, meta: true },
    plugins: [
      ...(config.plugins || []),
      [
        'react-native-fbsdk-next',
        {
          appID,
          clientToken,
          displayName: 'Pacific Elite Rides',
          scheme: `fb${appID}`,
          isAutoInitEnabled: true,
          autoLogAppEventsEnabled: true,
          advertiserIDCollectionEnabled: false,
          iosUserTrackingPermission: false,
        },
      ],
    ],
  };
};
