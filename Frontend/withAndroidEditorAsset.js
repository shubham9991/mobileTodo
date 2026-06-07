const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withAndroidEditorAsset(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const androidAssetsPath = path.join(
        config.modRequest.platformProjectRoot,
        'app/src/main/assets'
      );

      // Ensure the assets directory exists
      if (!fs.existsSync(androidAssetsPath)) {
        fs.mkdirSync(androidAssetsPath, { recursive: true });
      }

      // Source and destination paths
      const sourceFile = path.join(projectRoot, 'lexical-editor/dist/index.html');
      const destFile = path.join(androidAssetsPath, 'editor.html');

      if (fs.existsSync(sourceFile)) {
        fs.copyFileSync(sourceFile, destFile);
        console.log(`[withAndroidEditorAsset] Copied editor.html successfully to ${destFile}`);
      } else {
        console.warn(`[withAndroidEditorAsset] WARNING: Source file not found at ${sourceFile}. Run "npm run build:rn" inside lexical-editor to compile it first.`);
      }

      return config;
    },
  ]);
};
