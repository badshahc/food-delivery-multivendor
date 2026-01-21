#!/usr/bin/env node

/**
 * Script to fix @react-native-community/clipboard compatibility with React Native 0.81.5
 * Replaces ContextBaseJavaModule with ReactContextBaseJavaModule
 */

const fs = require('fs');
const path = require('path');

function fixClipboardModule(filePath) {
  if (fs.existsSync(filePath)) {
    try {
      let content = fs.readFileSync(filePath, 'utf8');
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
      
      // Fix constructor parameter type - change any Context type to ReactApplicationContext
      if (content.includes('public ClipboardModule(')) {
        // Handle: public ClipboardModule(Context context) - android.content.Context
        content = content.replace(
          /public ClipboardModule\(Context context\)/g,
          'public ClipboardModule(ReactApplicationContext context)'
        );
        // Handle: public ClipboardModule(ReactContext reactContext)
        content = content.replace(
          /public ClipboardModule\(ReactContext reactContext\)/g,
          'public ClipboardModule(ReactApplicationContext reactContext)'
        );
        // Handle: public ClipboardModule(ReactContext context)
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
        
        // Fix super() call - match the parameter name
        // If constructor has 'reactContext' parameter, update super call
        if (content.includes('public ClipboardModule(ReactApplicationContext reactContext)')) {
          content = content.replace(/super\(context\)/g, 'super(reactContext)');
        }
        // If constructor has 'context' parameter, super(context) should work after type change
        
        // Add super call if completely missing
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
      
      // Fix getContext() method - ReactContextBaseJavaModule uses getReactApplicationContext()
      if (content.includes('getContext()')) {
        content = content.replace(/getContext\(\)/g, 'getReactApplicationContext()');
      }
      
      // Only write if content changed
      if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✅ Fixed clipboard module: ${filePath}`);
        return true;
      }
    } catch (error) {
      console.warn(`⚠️  Could not fix ${filePath}:`, error.message);
    }
  }
  return false;
}

// Find clipboard module in node_modules
const projectRoot = __dirname.replace(/\/scripts$/, '');
const nodeModulesPath = path.join(projectRoot, 'node_modules');
const clipboardBasePath = path.join(
  nodeModulesPath,
  '@react-native-community',
  'clipboard',
  'android',
  'src',
  'main',
  'java',
  'com',
  'reactnativecommunity',
  'clipboard'
);

const clipboardModulePath = path.join(clipboardBasePath, 'ClipboardModule.java');
const clipboardPackagePath = path.join(clipboardBasePath, 'ClipboardPackage.java');

let fixed = false;

if (fixClipboardModule(clipboardModulePath)) {
  fixed = true;
}

// Also fix ClipboardPackage.java if needed
if (fs.existsSync(clipboardPackagePath)) {
  try {
    let content = fs.readFileSync(clipboardPackagePath, 'utf8');
    const originalContent = content;
    
    // Ensure ReactApplicationContext is imported if ClipboardModule uses it
    if (content.includes('new ClipboardModule(') && !content.includes('ReactApplicationContext')) {
      if (!content.includes('import com.facebook.react.bridge.ReactApplicationContext')) {
        content = content.replace(
          /(package com\.reactnativecommunity\.clipboard;)/,
          '$1\nimport com.facebook.react.bridge.ReactApplicationContext;'
        );
      }
    }
    
    if (content !== originalContent) {
      fs.writeFileSync(clipboardPackagePath, content, 'utf8');
      console.log(`✅ Fixed clipboard package: ${clipboardPackagePath}`);
      fixed = true;
    }
  } catch (error) {
    console.warn(`⚠️  Could not fix package: ${error.message}`);
  }
}

if (fixed) {
  console.log('✅ @react-native-community/clipboard fixed');
} else {
  console.log('ℹ️  @react-native-community/clipboard not found or already fixed');
}

