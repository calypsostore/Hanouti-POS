const MAX_IMAGE_DATA_URL_LENGTH = 300 * 1024
const IMAGE_SIZE = 256

export async function resizeImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.')
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = IMAGE_SIZE
  canvas.height = IMAGE_SIZE
  const context = canvas.getContext('2d')
  if (!context) {
    bitmap.close()
    throw new Error('Image resizing is not supported in this browser.')
  }
  const scale = Math.max(IMAGE_SIZE / bitmap.width, IMAGE_SIZE / bitmap.height)
  const width = bitmap.width * scale
  const height = bitmap.height * scale
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, IMAGE_SIZE, IMAGE_SIZE)
  context.drawImage(bitmap, (IMAGE_SIZE - width) / 2, (IMAGE_SIZE - height) / 2, width, height)
  bitmap.close()

  for (const quality of [0.88, 0.78, 0.68, 0.58, 0.48, 0.38]) {
    const dataUrl = canvas.toDataURL('image/jpeg', quality)
    if (dataUrl.length <= MAX_IMAGE_DATA_URL_LENGTH) return dataUrl
  }
  throw new Error('This image cannot be compressed below 300 KB.')
}
