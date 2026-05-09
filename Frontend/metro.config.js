const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// ─── Support TFLite model assets bundled via require() ────────────────────────
config.resolver.assetExts.push('tflite');

// ─── Ensure lodash (required by react-native-calendars) resolves correctly ────
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  lodash: path.resolve(__dirname, 'node_modules/lodash'),
};

module.exports = config;
