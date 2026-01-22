# Android signing setup

This directory contains signing configuration templates for CI and local
builds.

## Local setup

1. Copy `key.properties.example` to `key.properties`.
2. Place your `keystore.jks` in this directory.
3. Ensure your `android/app/build.gradle` includes:

```
apply from: "signing.gradle"
```

Do not commit `key.properties` or `keystore.jks`.
