#!/usr/bin/env node

/**
 * Script to add Gradle fix tasks to android/build.gradle
 * Run this after prebuild or if android/build.gradle exists
 */

const fs = require('fs');
const path = require('path');

const projectRoot = __dirname.replace(/\/scripts$/, '');
const buildGradlePath = path.join(projectRoot, 'android', 'build.gradle');

if (!fs.existsSync(buildGradlePath)) {
  console.log('ℹ️  android/build.gradle not found. Run "npx expo prebuild --platform android" first.');
  process.exit(0);
}

let content = fs.readFileSync(buildGradlePath, 'utf8');

// Check if fixes are already added
if (content.includes('fixVectorIconsGradle') || content.includes('fixClipboardModule')) {
  console.log('ℹ️  Gradle fixes already added to android/build.gradle');
  process.exit(0);
}

// Find the insertion point (before "apply plugin")
const applyPluginIndex = content.indexOf('apply plugin: "expo-root-project"');
if (applyPluginIndex === -1) {
  console.log('⚠️  Could not find insertion point in build.gradle');
  process.exit(1);
}

const gradleFixes = `
// Fix @react-native-community/clipboard compatibility issue
task fixClipboardModule {
  doFirst {
    println "🔧 Fixing @react-native-community/clipboard module..."
    
    def searchPaths = []
    def baseDir = rootProject.projectDir
    
    // Search for clipboard module
    for (int i = 0; i < 5; i++) {
      def path = baseDir
      for (int j = 0; j < i; j++) {
        path = path.parentFile
      }
      def javaFile = new File(path, "node_modules/@react-native-community/clipboard/android/src/main/java/com/reactnativecommunity/clipboard/ClipboardModule.java")
      if (javaFile.exists()) {
        searchPaths.add(javaFile.absolutePath)
      }
    }
    
    def searchDir = baseDir
    for (int i = 0; i < 5; i++) {
      def nodeModules = new File(searchDir, "node_modules")
      if (nodeModules.exists() && nodeModules.isDirectory()) {
        def clipboardDir = new File(nodeModules, "@react-native-community/clipboard")
        if (clipboardDir.exists()) {
          def javaFile = new File(clipboardDir, "android/src/main/java/com/reactnativecommunity/clipboard/ClipboardModule.java")
          if (javaFile.exists()) {
            searchPaths.add(javaFile.absolutePath)
          }
        }
      }
      searchDir = searchDir.parentFile
      if (searchDir == null) break
    }
    
    searchPaths = searchPaths.unique()
    
    boolean fixed = false
    searchPaths.each { javaPath ->
      def javaFile = file(javaPath)
      if (javaFile.exists()) {
        try {
          def content = javaFile.text
          def fixedContent = content
          boolean changed = false
          
          // Replace ContextBaseJavaModule with ReactContextBaseJavaModule
          if (fixedContent.contains('ContextBaseJavaModule') || fixedContent.contains('extends ContextBaseJavaModule')) {
            fixedContent = fixedContent.replaceAll(
              /import com\.facebook\.react\.bridge\.ContextBaseJavaModule;/,
              'import com.facebook.react.bridge.ReactContextBaseJavaModule;\\nimport com.facebook.react.bridge.ReactApplicationContext;'
            )
            fixedContent = fixedContent.replaceAll(
              /extends ContextBaseJavaModule/,
              'extends ReactContextBaseJavaModule'
            )
            changed = true
          }
          
          // Fix constructor parameter type
          if (fixedContent.contains('public ClipboardModule(')) {
            fixedContent = fixedContent.replaceAll(
              /public ClipboardModule\\(Context context\\)/,
              'public ClipboardModule(ReactApplicationContext context)'
            )
            fixedContent = fixedContent.replaceAll(
              /public ClipboardModule\\(ReactContext reactContext\\)/,
              'public ClipboardModule(ReactApplicationContext reactContext)'
            )
            fixedContent = fixedContent.replaceAll(
              /public ClipboardModule\\(ReactContext context\\)/,
              'public ClipboardModule(ReactApplicationContext context)'
            )
            
            // Ensure ReactApplicationContext is imported
            if (fixedContent.contains('ReactApplicationContext') && !fixedContent.contains('import com.facebook.react.bridge.ReactApplicationContext')) {
              fixedContent = fixedContent.replaceAll(
                /(package com\\.reactnativecommunity\\.clipboard;)/,
                '\$1\\n\\nimport com.facebook.react.bridge.ReactApplicationContext;'
              )
            }
            
            // Fix super() call
            if (fixedContent.contains('public ClipboardModule(ReactApplicationContext reactContext)')) {
              fixedContent = fixedContent.replaceAll(/super\\(context\\)/, 'super(reactContext)')
            }
            
            // Add super call if missing
            if (fixedContent.contains('public ClipboardModule(ReactApplicationContext') && 
                !fixedContent.contains('super(')) {
              fixedContent = fixedContent.replaceAll(
                /(public ClipboardModule\\(ReactApplicationContext reactContext\\)\\s*\\{)/,
                '\$1\\n    super(reactContext);'
              )
              fixedContent = fixedContent.replaceAll(
                /(public ClipboardModule\\(ReactApplicationContext context\\)\\s*\\{)/,
                '\$1\\n    super(context);'
              )
            }
          }
          
          // Fix getContext() method
          if (fixedContent.contains('getContext()')) {
            fixedContent = fixedContent.replaceAll(/getContext\\(\\)/g, 'getReactApplicationContext()')
          }
          
          if (changed && content != fixedContent) {
            javaFile.write(fixedContent, 'UTF-8')
            println "✅ Fixed: \${javaFile.absolutePath}"
            fixed = true
          }
        } catch (Exception e) {
          println "⚠️  Error fixing \${javaFile.absolutePath}: \${e.message}"
        }
      }
    }
    
    if (!fixed && searchPaths.isEmpty()) {
      println "⚠️  @react-native-community/clipboard module not found."
    }
  }
}

// Fix react-native-vector-icons Gradle compatibility issue
task fixVectorIconsGradle {
  doFirst {
    println "🔧 Fixing react-native-vector-icons Gradle file..."
    
    def appCompileSdk = 34
    try {
      if (rootProject.ext.has('compileSdkVersion')) {
        appCompileSdk = rootProject.ext.compileSdkVersion
      }
    } catch (Exception e) {
    }
    def minCompileSdk = Math.max(appCompileSdk, 30)
    
    def searchPaths = []
    def baseDir = rootProject.projectDir
    
    for (int i = 0; i < 5; i++) {
      def path = baseDir
      for (int j = 0; j < i; j++) {
        path = path.parentFile
      }
      def gradleFile = new File(path, "node_modules/react-native-vector-icons/android/build.gradle")
      if (gradleFile.exists()) {
        searchPaths.add(gradleFile.absolutePath)
      }
    }
    
    def searchDir = baseDir
    for (int i = 0; i < 5; i++) {
      def nodeModules = new File(searchDir, "node_modules")
      if (nodeModules.exists() && nodeModules.isDirectory()) {
        nodeModules.eachDir { dir ->
          if (dir.name == 'react-native-vector-icons') {
            def gradleFile = new File(dir, "android/build.gradle")
            if (gradleFile.exists()) {
              searchPaths.add(gradleFile.absolutePath)
            }
          }
        }
      }
      searchDir = searchDir.parentFile
      if (searchDir == null) break
    }
    
    searchPaths = searchPaths.unique()
    
    boolean fixed = false
    searchPaths.each { gradlePath ->
      def gradleFile = file(gradlePath)
      if (gradleFile.exists()) {
        try {
          def content = gradleFile.text
          def fixedContent = content
          boolean changed = false
          
          if (fixedContent.contains('compile(') || fixedContent.contains('compile ')) {
            fixedContent = fixedContent.replaceAll(/compile\\(/, 'implementation(')
            fixedContent = fixedContent.replaceAll(/compile\\s+/, 'implementation ')
            changed = true
          }
          
          def compileSdkPattern = /compileSdkVersion\\s+(\\d+)/
          def compileSdkMatch = fixedContent =~ compileSdkPattern
          if (compileSdkMatch.find()) {
            def currentSdk = compileSdkMatch.group(1).toInteger()
            if (currentSdk < minCompileSdk) {
              fixedContent = fixedContent.replaceAll(compileSdkPattern, "compileSdkVersion \${minCompileSdk}")
              changed = true
            }
          } else {
            if (fixedContent.contains('android {')) {
              fixedContent = fixedContent.replaceFirst(
                /(android\\s*\\{)/,
                "\$1\\n        compileSdkVersion \${minCompileSdk}"
              )
              changed = true
            }
          }
          
          if (changed && content != fixedContent) {
            gradleFile.write(fixedContent, 'UTF-8')
            println "✅ Fixed: \${gradleFile.absolutePath}"
            fixed = true
          }
        } catch (Exception e) {
          println "⚠️  Error fixing \${gradleFile.absolutePath}: \${e.message}"
        }
      }
    }
    
    if (!fixed && searchPaths.isEmpty()) {
      println "⚠️  react-native-vector-icons build.gradle not found."
    }
  }
}

// Run fix tasks before any compilation tasks
tasks.whenTaskAdded { task ->
  if (task.name.contains('compile') || 
      task.name.contains('assemble') || 
      task.name.contains('bundle') ||
      task.name == 'preBuild' ||
      task.name.contains('react-native-vector-icons') ||
      task.name.contains('clipboard')) {
    task.dependsOn fixVectorIconsGradle
    task.dependsOn fixClipboardModule
  }
}

// Also ensure it runs early
afterEvaluate {
  allprojects { project ->
    project.tasks.configureEach { task ->
      if ((task.name.contains('compile') || 
           task.name.contains('assemble') || 
           task.name == 'preBuild') &&
          !task.name.contains('fixVectorIcons') &&
          !task.name.contains('fixClipboard')) {
        try {
          task.dependsOn rootProject.tasks.fixVectorIconsGradle
          task.dependsOn rootProject.tasks.fixClipboardModule
        } catch (Exception e) {
        }
      }
    }
  }
}

`;

// Insert before "apply plugin: expo-root-project"
const newContent = 
  content.slice(0, applyPluginIndex) + 
  gradleFixes + 
  '\n' + 
  content.slice(applyPluginIndex);

fs.writeFileSync(buildGradlePath, newContent, 'utf8');
console.log('✅ Added Gradle fix tasks to android/build.gradle');

