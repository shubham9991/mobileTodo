const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = function withWindowsShortPaths(config) {
  return withAppBuildGradle(config, (config) => {
    // 1. Add buildStagingDirectory 'C:/cxx' to prevent Windows 260 character path limit errors
    if (!config.modResults.contents.includes("buildStagingDirectory 'C:/cxx'")) {
      config.modResults.contents = config.modResults.contents.replace(
        /android\s*\{/,
        `android {
    externalNativeBuild {
        cmake {
            buildStagingDirectory 'C:/cxx'
        }
    }`
      );
    }
    
    // 2. Add multiDexEnabled true
    if (!config.modResults.contents.includes("multiDexEnabled true")) {
      config.modResults.contents = config.modResults.contents.replace(
        /defaultConfig\s*\{([^}]*)\}/m,
        (match, p1) => {
          return `defaultConfig {${p1}        multiDexEnabled true\n    }`;
        }
      );
    }

    return config;
  });
};
