const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// ─── Support TFLite model assets bundled via require() ────────────────────────
config.resolver.assetExts.push('tflite');

module.exports = config;
