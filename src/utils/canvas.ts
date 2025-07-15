export function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export async function convertToImageData(imageBitmap: ImageBitmap): Promise<ImageData> {
  const canvas = createCanvas(imageBitmap.width, imageBitmap.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('No se pudo obtener el contexto 2D del canvas');
  }
  ctx.drawImage(imageBitmap, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}
