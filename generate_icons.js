const fs = require('fs');
const { createCanvas } = require('canvas');

const sizes = [16, 48, 128];

function generateIcon(size) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#4F46E5';
    ctx.fillRect(0, 0, size, size);

    // Text
    ctx.fillStyle = 'white';
    ctx.font = `${size * 0.5}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('P', size/2, size/2);

    return canvas.toBuffer();
}

sizes.forEach(size => {
    const iconBuffer = generateIcon(size);
    fs.writeFileSync(`icons/icon${size}.png`, iconBuffer);
    console.log(`Generated icon${size}.png`);
}); 