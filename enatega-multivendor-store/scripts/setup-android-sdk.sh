#!/bin/bash

# Script to set up Android SDK for local EAS builds
# Run this before building: source scripts/setup-android-sdk.sh

# Check if ANDROID_HOME is already set
if [ -n "$ANDROID_HOME" ]; then
  echo "✅ ANDROID_HOME is already set to: $ANDROID_HOME"
  exit 0
fi

# Common Android SDK locations on macOS
POSSIBLE_PATHS=(
  "$HOME/Library/Android/sdk"
  "$HOME/Android/Sdk"
  "/Users/$USER/Library/Android/sdk"
  "/Users/$USER/Android/Sdk"
)

# Try to find the SDK
SDK_PATH=""
for path in "${POSSIBLE_PATHS[@]}"; do
  if [ -d "$path" ]; then
    SDK_PATH="$path"
    break
  fi
done

if [ -z "$SDK_PATH" ]; then
  echo "❌ Android SDK not found in common locations:"
  for path in "${POSSIBLE_PATHS[@]}"; do
    echo "   - $path"
  done
  echo ""
  echo "Please install Android Studio or set ANDROID_HOME manually:"
  echo "  export ANDROID_HOME=/path/to/android/sdk"
  exit 1
fi

# Set ANDROID_HOME
export ANDROID_HOME="$SDK_PATH"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/tools:$PATH"

echo "✅ Android SDK found at: $ANDROID_HOME"
echo "✅ ANDROID_HOME has been set for this session"
echo ""
echo "To make this permanent, add to your ~/.zshrc:"
echo "  export ANDROID_HOME=\"$ANDROID_HOME\""
echo "  export PATH=\"\$ANDROID_HOME/platform-tools:\$ANDROID_HOME/tools:\$PATH\""

