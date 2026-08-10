const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withLargeNotificationIcon = (config) => {
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const resDir = path.join(config.modRequest.projectRoot, 'android', 'app', 'src', 'main', 'res');

      // 1. Copy notification_large_icon.png
      const srcFile = path.join(config.modRequest.projectRoot, 'assets', 'notification_large_icon.png');
      const targetDir = path.join(resDir, 'drawable');
      const targetFile = path.join(targetDir, 'notification_large_icon.png');

      if (fs.existsSync(srcFile)) {
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }
        fs.copyFileSync(srcFile, targetFile);
        console.log('[withLargeNotificationIcon] Copied notification_large_icon.png to Android res/drawable.');
      }

      // 2. Remove obsolete vector notification_icon.xml to prevent SystemUI RemoteViews black rectangle issue
      const xmlPath = path.join(resDir, 'drawable', 'notification_icon.xml');
      if (fs.existsSync(xmlPath)) {
        fs.unlinkSync(xmlPath);
        console.log('[withLargeNotificationIcon] Removed vector notification_icon.xml');
      }

      // 3. Ensure notification-icon.png from assets is copied to drawable/notification_icon.png
      const notifSrc = path.join(config.modRequest.projectRoot, 'assets', 'notification-icon.png');
      const notifTarget = path.join(resDir, 'drawable', 'notification_icon.png');
      if (fs.existsSync(notifSrc)) {
        fs.copyFileSync(notifSrc, notifTarget);
        console.log('[withLargeNotificationIcon] Copied notification-icon.png to res/drawable/notification_icon.png');
      }

      // 3. Delete duplicate webp launcher files from mipmap folders
      const mipmaps = ['mipmap-mdpi', 'mipmap-hdpi', 'mipmap-xhdpi', 'mipmap-xxhdpi', 'mipmap-xxxhdpi'];
      for (const m of mipmaps) {
        const mDir = path.join(resDir, m);
        if (fs.existsSync(mDir)) {
          const files = fs.readdirSync(mDir);
          for (const f of files) {
            if (f.endsWith('.webp')) {
              fs.unlinkSync(path.join(mDir, f));
              console.log(`[withLargeNotificationIcon] Removed duplicate webp launcher file ${m}/${f}`);
            }
          }
        }
      }



      return config;
    },
  ]);

  // Add meta-data to AndroidManifest.xml
  config = withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;
    const application = androidManifest.manifest.application[0];

    if (!application['meta-data']) {
      application['meta-data'] = [];
    }

    const metaDatas = application['meta-data'];

    const requiredMetaData = [
      {
        $: {
          'android:name': 'expo.modules.notifications.default_notification_icon',
          'android:resource': '@mipmap/ic_launcher',
        },
      },
      {
        $: {
          'android:name': 'com.google.firebase.messaging.default_notification_icon',
          'android:resource': '@mipmap/ic_launcher',
        },
      },
    ];

    for (const item of requiredMetaData) {
      const existingIndex = metaDatas.findIndex(
        (m) => m.$['android:name'] === item.$['android:name']
      );
      if (existingIndex !== -1) {
        metaDatas[existingIndex] = item;
      } else {
        metaDatas.push(item);
      }
    }

    return config;
  });

  return config;
};

module.exports = withLargeNotificationIcon;
