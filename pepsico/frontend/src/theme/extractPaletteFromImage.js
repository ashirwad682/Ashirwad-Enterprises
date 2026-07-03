import ColorThief from 'color-thief-browser';

export async function extractPaletteFromImage(imageUrl, colorCount = 5) {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = 'Anonymous';
    img.src = imageUrl;
    img.onload = () => {
      try {
        const colorThief = new ColorThief();
        const palette = colorThief.getPalette(img, colorCount);
        resolve(palette.map(rgb => rgbToHex(rgb[0], rgb[1], rgb[2])));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = reject;
  });
}

function rgbToHex(r, g, b) {
  return (
    '#' +
    [r, g, b]
      .map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      })
      .join('')
  );
}
