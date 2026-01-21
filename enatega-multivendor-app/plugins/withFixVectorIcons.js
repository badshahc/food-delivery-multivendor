const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Fix react-native-vector-icons build.gradle file
 * Replaces deprecated compile() with implementation() and sets compileSdkVersion
 */
function fixVectorIconsGradle(gradlePath) {
  if (fs.existsSync(gradlePath)) {
    try {
      let gradleContent = fs.readFileSync(gradlePath, 'utf8');
      const originalContent = gradleContent;
      
      // Replace compile() with implementation()
      gradleContent = gradleContent.replace(/compile\(/g, 'implementation(');
      gradleContent = gradleContent.replace(/compile\s+/g, 'implementation ');
      
      // Fix compileSdkVersion (set to at least 30 for Java 9+)
      const compileSdkRegex = /compileSdkVersion\s+(\d+)/;
      const match = gradleContent.match(compileSdkRegex);
      const minCompileSdk = 30;
      
      if (match) {
        const currentSdk = parseInt(match[1], 10);
        if (currentSdk < minCompileSdk) {
          gradleContent = gradleContent.replace(compileSdkRegex, `compileSdkVersion ${minCompileSdk}`);
        }
      } else {
        // Add compileSdkVersion if it doesn't exist (in android block)
        if (gradleContent.includes('android {')) {
          gradleContent = gradleContent.replace(
            /(android\s*\{)/,
            `$1\n    compileSdkVersion ${minCompileSdk}`
          );
        }
      }
      
      // Only write if content changed
      if (gradleContent !== originalContent) {
        fs.writeFileSync(gradlePath, gradleContent, 'utf8');
        console.log(`✅ Fixed react-native-vector-icons build.gradle: ${gradlePath}`);
        return true;
      }
    } catch (error) {
      console.warn(`⚠️  Could not fix ${gradlePath}:`, error.message);
    }
  }
  return false;
}

/**
 * Expo config plugin to fix react-native-vector-icons Gradle build issue
 */
const withFixVectorIcons = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.platformProjectRoot;
      
      // Try multiple possible locations
      const possiblePaths = [
        path.join(projectRoot, 'node_modules', 'react-native-vector-icons', 'android', 'build.gradle'),
        path.join(projectRoot, '..', 'node_modules', 'react-native-vector-icons', 'android', 'build.gradle'),
        path.join(projectRoot, '../..', 'node_modules', 'react-native-vector-icons', 'android', 'build.gradle'),
      ];

      // Also search recursively in node_modules
      const nodeModulesPath = path.join(projectRoot, '..', 'node_modules');
      if (fs.existsSync(nodeModulesPath)) {
        try {
          const vectorIconsPath = path.join(nodeModulesPath, 'react-native-vector-icons', 'android', 'build.gradle');
          if (fs.existsSync(vectorIconsPath)) {
            possiblePaths.unshift(vectorIconsPath);
          }
        } catch (e) {
          // Ignore errors
        }
      }

      // Try to fix all found paths
      let fixed = false;
      for (const gradlePath of possiblePaths) {
        if (fixVectorIconsGradle(gradlePath)) {
          fixed = true;
        }
      }

      if (!fixed) {
        console.warn('⚠️  react-native-vector-icons build.gradle not found. The Gradle task will fix it during build.');
      }

      return config;
    },
  ]);
};

module.exports = withFixVectorIcons;

