// generate-app-icons.js
// This is a Node.js script - run it from terminal with: node generate-app-icons.js

const fs = require('fs');
const path = require('path');

// Use process.cwd() instead of __dirname for better compatibility
const projectRoot = process.cwd();
const assetsDir = path.join(projectRoot, 'assets');

// Create assets directory if it doesn't exist
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
} else {
  console.log('✅ Assets directory already exists');
}
