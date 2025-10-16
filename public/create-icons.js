// This is a helper script to create basic PWA icons
// Run this with Node.js to generate placeholder icons

const fs = require('fs');

// Create a simple SVG icon as a base
const createSVGIcon = (size, color = '#387ADF') => {
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="${color}" rx="20"/>
  <text x="50%" y="50%" text-anchor="middle" dy="0.35em" fill="white" font-family="Arial, sans-serif" font-size="${size/4}" font-weight="bold">Z</text>
</svg>`;
};

// Create favicon.ico placeholder
const faviconSVG = createSVGIcon(32);
fs.writeFileSync('favicon.ico', ''); // Placeholder

// Create different sized icons
const iconSizes = [16, 32, 180, 192, 512];

iconSizes.forEach(size => {
  const svg = createSVGIcon(size);
  let filename;
  
  if (size === 16) filename = 'favicon-16x16.png';
  else if (size === 32) filename = 'favicon-32x32.png';
  else if (size === 180) filename = 'apple-touch-icon.png';
  else filename = `icon-${size}x${size}.png`;
  
  // In a real implementation, you'd convert SVG to PNG
  // For now, we'll create SVG files as placeholders
  fs.writeFileSync(filename.replace('.png', '.svg'), svg);
});

console.log('Icon placeholders created! Convert SVG files to PNG for production use.');
