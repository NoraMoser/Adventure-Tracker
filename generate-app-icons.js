// generate-app-icons.js
// This is a Node.js script - run it from terminal with: node generate-app-icons.js

const fs = require('fs');
const path = require('path');

// Use process.cwd() instead of __dirname for better compatibility
const projectRoot = process.cwd();
const assetsDir = path.join(projectRoot, 'assets');

console.log('📁 Working directory:', projectRoot);
console.log('📁 Assets directory:', assetsDir);

// Create assets directory if it doesn't exist
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
  console.log('✅ Created assets directory');
} else {
  console.log('✅ Assets directory already exists');
}

// Create placeholder message
console.log('\n📱 To create your app icons:');
console.log('1. Go to https://www.appicon.co/');
console.log('2. Upload an image with your logo');
console.log('3. Use background color: #2d5a3d (forest green)');
console.log('4. Download and extract the icons');
console.log('5. Copy the following files to your assets folder:');
console.log('   - icon.png (1024x1024)');
console.log('   - adaptive-icon.png (1024x1024)');
console.log('   - splash.png (1284x2778)');