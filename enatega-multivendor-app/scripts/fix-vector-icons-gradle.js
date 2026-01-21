#!/usr/bin/env node

/**
 * Script to fix react-native-vector-icons Gradle build issue
 * Replaces deprecated compile() with implementation()
 */

const fs = require('fs');
const path = require('path');

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

// Find react-native-vector-icons in node_modules
const projectRoot = __dirname.replace(/\/scripts$/, '');
const nodeModulesPath = path.join(projectRoot, 'node_modules');
const vectorIconsGradlePath = path.join(
  nodeModulesPath,
  'react-native-vector-icons',
  'android',
  'build.gradle'
);

if (fixVectorIconsGradle(vectorIconsGradlePath)) {
  console.log('✅ react-native-vector-icons Gradle file fixed');
} else {
  console.log('ℹ️  react-native-vector-icons build.gradle not found or already fixed');
}

