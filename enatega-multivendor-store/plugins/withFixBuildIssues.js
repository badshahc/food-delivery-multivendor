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
 * Fix @react-native-community/clipboard module
 */
function fixClipboardModule(gradlePath) {
  if (fs.existsSync(gradlePath)) {
    try {
      let content = fs.readFileSync(gradlePath, 'utf8');
      const originalContent = content;
      
      // Replace ContextBaseJavaModule with ReactContextBaseJavaModule
      if (content.includes('ContextBaseJavaModule') || content.includes('extends ContextBaseJavaModule')) {
        content = content.replace(
          /import com\.facebook\.react\.bridge\.ContextBaseJavaModule;/g,
          'import com.facebook.react.bridge.ReactContextBaseJavaModule;\nimport com.facebook.react.bridge.ReactApplicationContext;'
        );
        content = content.replace(
          /extends ContextBaseJavaModule/g,
          'extends ReactContextBaseJavaModule'
        );
      }
      
      // Fix constructor parameter type
      if (content.includes('public ClipboardModule(')) {
        content = content.replace(
          /public ClipboardModule\(Context context\)/g,
          'public ClipboardModule(ReactApplicationContext context)'
        );
        content = content.replace(
          /public ClipboardModule\(ReactContext reactContext\)/g,
          'public ClipboardModule(ReactApplicationContext reactContext)'
        );
        content = content.replace(
          /public ClipboardModule\(ReactContext context\)/g,
          'public ClipboardModule(ReactApplicationContext context)'
        );
        
        // Ensure ReactApplicationContext is imported
        if (content.includes('ReactApplicationContext') && !content.includes('import com.facebook.react.bridge.ReactApplicationContext')) {
          content = content.replace(
            /(package com\.reactnativecommunity\.clipboard;)/,
            '$1\n\nimport com.facebook.react.bridge.ReactApplicationContext;'
          );
        }
        
        // Fix super() call
        if (content.includes('public ClipboardModule(ReactApplicationContext reactContext)')) {
          content = content.replace(/super\(context\)/g, 'super(reactContext)');
        }
        
        // Add super call if missing
        if (content.includes('public ClipboardModule(ReactApplicationContext') && 
            !content.includes('super(')) {
          content = content.replace(
            /(public ClipboardModule\(ReactApplicationContext reactContext\)\s*\{)/,
            '$1\n    super(reactContext);'
          );
          content = content.replace(
            /(public ClipboardModule\(ReactApplicationContext context\)\s*\{)/,
            '$1\n    super(context);'
          );
        }
      }
      
      // Fix getContext() method
      if (content.includes('getContext()')) {
        content = content.replace(/getContext\(\)/g, 'getReactApplicationContext()');
      }
      
      if (content !== originalContent) {
        fs.writeFileSync(gradlePath, content, 'utf8');
        console.log(`✅ Fixed clipboard module: ${gradlePath}`);
        return true;
      }
    } catch (error) {
      console.warn(`⚠️  Could not fix ${gradlePath}:`, error.message);
    }
  }
  return false;
}

/**
 * Add Gradle fix tasks to android/build.gradle
 */
function addGradleTasks(buildGradlePath) {
  if (!fs.existsSync(buildGradlePath)) {
    return false;
  }
  
  let content = fs.readFileSync(buildGradlePath, 'utf8');
  
  // Check if fixes are already added
  if (content.includes('fixVectorIconsGradle') || content.includes('fixClipboardModule')) {
    return false;
  }
  
  // Find insertion point (before "apply plugin: expo-root-project")
  const applyPluginIndex = content.indexOf('apply plugin: "expo-root-project"');
  if (applyPluginIndex === -1) {
    return false;
  }
  
  const gradleFixes = `
// Fix @react-native-community/clipboard compatibility issue
task fixClipboardModule {
  doFirst {
    println "🔧 Fixing @react-native-community/clipboard module..."
    
    def searchPaths = []
    def baseDir = rootProject.projectDir
    
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
          
          if (fixedContent.contains('ContextBaseJavaModule') || fixedContent.contains('extends ContextBaseJavaModule')) {
            fixedContent = fixedContent.replaceAll(
              /import com\\.facebook\\.react\\.bridge\\.ContextBaseJavaModule;/,
              'import com.facebook.react.bridge.ReactContextBaseJavaModule;\\nimport com.facebook.react.bridge.ReactApplicationContext;'
            )
            fixedContent = fixedContent.replaceAll(
              /extends ContextBaseJavaModule/,
              'extends ReactContextBaseJavaModule'
            )
            changed = true
          }
          
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
            
            if (fixedContent.contains('ReactApplicationContext') && !fixedContent.contains('import com.facebook.react.bridge.ReactApplicationContext')) {
              fixedContent = fixedContent.replaceAll(
                /(package com\\.reactnativecommunity\\.clipboard;)/,
                '\$1\\n\\nimport com.facebook.react.bridge.ReactApplicationContext;'
              )
            }
            
            if (fixedContent.contains('public ClipboardModule(ReactApplicationContext reactContext)')) {
              fixedContent = fixedContent.replaceAll(/super\\(context\\)/, 'super(reactContext)')
            }
            
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
              def replacement = 'compileSdkVersion ' + minCompileSdk.toString()
              fixedContent = fixedContent.replaceAll(compileSdkPattern, replacement)
              changed = true
            }
          } else {
            if (fixedContent.contains('android {')) {
              def sdkValue = minCompileSdk.toString()
              def replacement = '\$1\\n        compileSdkVersion ' + sdkValue
              fixedContent = fixedContent.replaceFirst(
                /(android\\s*\\{)/,
                replacement
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

  const newContent = 
    content.slice(0, applyPluginIndex) + 
    gradleFixes + 
    '\n' + 
    content.slice(applyPluginIndex);
  
  fs.writeFileSync(buildGradlePath, newContent, 'utf8');
  console.log('✅ Added Gradle fix tasks to android/build.gradle');
  return true;
}

/**
 * Ensure gradle.properties has proper memory settings
 */
function ensureGradleProperties(gradlePropertiesPath) {
  if (!fs.existsSync(gradlePropertiesPath)) {
    // Create gradle.properties with memory settings
    const gradlePropertiesContent = `# Project-wide Gradle settings.

# Specifies the JVM arguments used for the daemon process.
# Increased memory settings to fix Metaspace errors
org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8

# AndroidX package structure
android.useAndroidX=true
android.enableJetifier=true

# React Native settings
reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64
newArchEnabled=true
hermesEnabled=true

# Kotlin incremental compilation
kotlin.incremental=true
ksp.incremental=true
`;
    fs.writeFileSync(gradlePropertiesPath, gradlePropertiesContent, 'utf8');
    console.log('✅ Created gradle.properties with increased memory settings');
    return true;
  } else {
    // Check if memory settings exist, add if missing
    let content = fs.readFileSync(gradlePropertiesPath, 'utf8');
    let modified = false;
    
    if (!content.includes('MaxMetaspaceSize')) {
      // Add or update org.gradle.jvmargs
      if (content.includes('org.gradle.jvmargs=')) {
        content = content.replace(
          /org\.gradle\.jvmargs=.*/,
          'org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8'
        );
      } else {
        content += '\n# Increased memory settings to fix Metaspace errors\norg.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8\n';
      }
      modified = true;
    }
    
    if (!content.includes('ksp.incremental')) {
      content += '\n# Kotlin Symbol Processing\nksp.incremental=true\n';
      modified = true;
    }
    
    if (modified) {
      fs.writeFileSync(gradlePropertiesPath, content, 'utf8');
      console.log('✅ Updated gradle.properties with memory settings');
      return true;
    }
  }
  return false;
}

/**
 * Expo config plugin to fix build issues
 */
const withFixBuildIssues = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.platformProjectRoot;
      const buildGradlePath = path.join(projectRoot, 'build.gradle');
      const gradlePropertiesPath = path.join(projectRoot, 'gradle.properties');
      
      // Ensure gradle.properties has proper memory settings
      ensureGradleProperties(gradlePropertiesPath);
      
      // Add Gradle fix tasks to build.gradle
      addGradleTasks(buildGradlePath);
      
      // Fix react-native-vector-icons
      const possiblePaths = [
        path.join(projectRoot, 'node_modules', 'react-native-vector-icons', 'android', 'build.gradle'),
        path.join(projectRoot, '..', 'node_modules', 'react-native-vector-icons', 'android', 'build.gradle'),
      ];
      
      for (const gradlePath of possiblePaths) {
        fixVectorIconsGradle(gradlePath);
      }
      
      // Fix clipboard module
      const clipboardPaths = [
        path.join(projectRoot, 'node_modules', '@react-native-community', 'clipboard', 'android', 'src', 'main', 'java', 'com', 'reactnativecommunity', 'clipboard', 'ClipboardModule.java'),
        path.join(projectRoot, '..', 'node_modules', '@react-native-community', 'clipboard', 'android', 'src', 'main', 'java', 'com', 'reactnativecommunity', 'clipboard', 'ClipboardModule.java'),
      ];
      
      for (const javaPath of clipboardPaths) {
        fixClipboardModule(javaPath);
      }
      
      return config;
    },
  ]);
};

module.exports = withFixBuildIssues;

