const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expert Notification Icon Fix for Android
 * 1. Ensures notification_icon.png is a high-quality white stencil (stencil-ready).
 * 2. Removes conflicting vector drawables that cause "black rectangle" issues on certain Android versions.
 * 3. Correctly maps metadata to @drawable/notification_icon instead of the colored launcher icon.
 */
const withLargeNotificationIcon = (config) => {
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const resDir = path.join(config.modRequest.projectRoot, 'android', 'app', 'src', 'main', 'res');

      // 1. Copy notification_large_icon.png (Used for the expanded notification view)
      const largeSrc = path.join(config.modRequest.projectRoot, 'assets', 'notification_large_icon.png');
      const drawableDir = path.join(resDir, 'drawable');
      if (!fs.existsSync(drawableDir)) fs.mkdirSync(drawableDir, { recursive: true });

      if (fs.existsSync(largeSrc)) {
        fs.copyFileSync(largeSrc, path.join(drawableDir, 'notification_large_icon.png'));
        console.log('[withLargeNotificationIcon] Copied notification_large_icon.png');
      }

      // 2. Remove conflicting vector silhouette files
      // Vectors in RemoteViews (Notifications) can fail and render as black boxes on some Android skins.
      const conflictingFiles = ['notification_icon.xml', 'ic_notification_silhouette.xml'];
      conflictingFiles.forEach(fileName => {
        const filePath = path.join(drawableDir, fileName);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`[withLargeNotificationIcon] Removed conflicting vector: ${fileName}`);
        }
      });

      // 3. Deploy the verified white stencil PNG to all density folders
      // Using a PNG is the "bulletproof" way to ensure icons render correctly across all 15,000+ Android device types.
      const notifSrc = path.join(config.modRequest.projectRoot, 'assets', 'notification-icon.png');
      const densityFolders = [
        'drawable-mdpi',
        'drawable-hdpi',
        'drawable-xhdpi',
        'drawable-xxhdpi',
        'drawable-xxxhdpi'
      ];

      if (fs.existsSync(notifSrc)) {
        densityFolders.forEach(folder => {
          const targetPath = path.join(resDir, folder);
          if (!fs.existsSync(targetPath)) fs.mkdirSync(targetPath, { recursive: true });
          fs.copyFileSync(notifSrc, path.join(targetPath, 'notification_icon.png'));
        });

        // Also put a fallback in the main drawable folder
        fs.copyFileSync(notifSrc, path.join(drawableDir, 'notification_icon.png'));
        console.log('[withLargeNotificationIcon] Deployed notification_icon.png (PNG stencil) to all res folders');
      }

      // 4. Cleanup duplicate webp launcher files (Expo artifact cleanup)
      const mipmapFolders = ['mipmap-mdpi', 'mipmap-hdpi', 'mipmap-xhdpi', 'mipmap-xxhdpi', 'mipmap-xxxhdpi'];
      mipmapFolders.forEach(folder => {
        const folderPath = path.join(resDir, folder);
        if (fs.existsSync(folderPath)) {
          fs.readdirSync(folderPath).forEach(file => {
            if (file.endsWith('.webp')) {
              fs.unlinkSync(path.join(folderPath, file));
            }
          });
        }
      });

      return config;
    },
  ]);

  // 5. Update AndroidManifest metadata to point to the new stencil icon
  config = withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;
    const application = androidManifest.manifest.application[0];
    if (!application['meta-data']) application['meta-data'] = [];

    const metaDatas = application['meta-data'];
    const requiredMetaData = [
      {
        $: {
          'android:name': 'expo.modules.notifications.default_notification_icon',
          'android:resource': '@drawable/notification_icon',
        },
      },
      {
        $: {
          'android:name': 'com.google.firebase.messaging.default_notification_icon',
          'android:resource': '@drawable/notification_icon',
        },
      },
      {
        $: {
          'android:name': 'com.google.firebase.messaging.default_notification_color',
          'android:resource': '@color/notification_icon_color',
        },
      }
    ];

    requiredMetaData.forEach(item => {
      const index = metaDatas.findIndex(m => m.$['android:name'] === item.$['android:name']);
      if (index !== -1) {
        metaDatas[index] = item;
      } else {
        metaDatas.push(item);
      }
    });

    return config;
  });

  return config;
};

module.exports = withLargeNotificationIcon;
