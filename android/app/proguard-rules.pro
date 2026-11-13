# Add project specific ProGuard rules here.
# Flags specified in this file are appended to flags specified in proguard-android-optimize.txt

# Preserve line numbers and source file names for Sentry and Google Play Console stack traces
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# React Native & TurboModules
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }
-keep class com.facebook.react.bridge.** { *; }
-keep class com.facebook.react.uimanager.** { *; }
-keep class com.facebook.jni.** { *; }

# Expo Modules
-keep class expo.modules.** { *; }

# Google Play Services & Firebase
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**

# Google Mobile Ads
-keep class com.google.android.gms.ads.** { *; }
-keep class com.google.ads.mediation.** { *; }

# Google Sign-In
-keep class com.google.android.gms.auth.api.signin.** { *; }

# Lottie Animations
-keep class com.airbnb.lottie.** { *; }
