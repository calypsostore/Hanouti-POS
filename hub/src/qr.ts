const DATA_CODEWORDS = [0, 19, 34, 55, 80]
const ECC_CODEWORDS = [0, 7, 10, 15, 20]

function multiply(x: number, y: number): number {
  let result = 0
  for (let i = 7; i >= 0; i -= 1) {
    result = (result << 1) ^ ((result >>> 7) * 0x11d)
    if (((y >>> i) & 1) !== 0) result ^= x
  }
  return result
}

function divisor(degree: number): number[] {
  let result: number[] = Array.from({ length: degree }, (_, index) => index === degree - 1 ? 1 : 0)
  let root = 1
  for (let i = 0; i < degree; i += 1) {
    for (let j = 0; j < result.length; j += 1) {
      result[j] = multiply(result[j], root)
      if (j + 1 < result.length) result[j] ^= result[j + 1]
    }
    root = multiply(root, 2)
  }
  return result
}

function remainder(data: number[], degree: number): number[] {
  const polynomial = divisor(degree)
  const result = Array.from({ length: degree }, () => 0)
  for (const byte of data) {
    const factor = byte ^ (result.shift() ?? 0)
    result.push(0)
    for (let i = 0; i < degree; i += 1) result[i] ^= multiply(polynomial[i], factor)
  }
  return result
}

function qrMatrix(text: string): boolean[][] {
  const bytes = [...new TextEncoder().encode(text)]
  const version = [1, 2, 3, 4].find((candidate) => bytes.length <= DATA_CODEWORDS[candidate] - 2)
  if (!version) throw new Error('URL is too long to encode as a QR code.')
  const dataLength = DATA_CODEWORDS[version]
  const bits: number[] = []
  const pushBits = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1)
  }
  pushBits(0b0100, 4)
  pushBits(bytes.length, 8)
  for (const byte of bytes) pushBits(byte, 8)
  for (let i = 0; i < Math.min(4, dataLength * 8 - bits.length); i += 1) bits.push(0)
  while (bits.length % 8) bits.push(0)
  const data: number[] = []
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((sum, bit) => sum * 2 + bit, 0))
  for (let pad = 0; data.length < dataLength; pad += 1) data.push(pad % 2 === 0 ? 0xec : 0x11)
  const codewords = [...data, ...remainder(data, ECC_CODEWORDS[version])]
  const size = version * 4 + 17
  const matrix = Array.from({ length: size }, () => Array.from({ length: size }, () => false))
  const reserved = Array.from({ length: size }, () => Array.from({ length: size }, () => false))
  const set = (x: number, y: number, value: boolean) => {
    if (x >= 0 && y >= 0 && x < size && y < size) {
      matrix[y][x] = value
      reserved[y][x] = true
    }
  }
  const finder = (left: number, top: number) => {
    for (let dy = -1; dy <= 7; dy += 1) for (let dx = -1; dx <= 7; dx += 1) {
      const on = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6 &&
        (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4))
      set(left + dx, top + dy, on)
    }
  }
  finder(0, 0)
  finder(size - 7, 0)
  finder(0, size - 7)
  for (let i = 8; i < size - 8; i += 1) {
    set(i, 6, i % 2 === 0)
    set(6, i, i % 2 === 0)
  }
  if (version > 1) {
    const position = size - 7
    for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) {
      const distance = Math.max(Math.abs(dx), Math.abs(dy))
      set(position + dx, position + dy, distance !== 1)
    }
  }
  const formatData = (0b01 << 3) | 0
  let rem = formatData
  for (let i = 0; i < 10; i += 1) rem = (rem << 1) ^ (((rem >>> 9) & 1) * 0x537)
  const format = ((formatData << 10) | rem) ^ 0x5412
  const formatBit = (index: number) => ((format >>> index) & 1) !== 0
  for (let i = 0; i <= 5; i += 1) set(8, i, formatBit(i))
  set(8, 7, formatBit(6))
  set(8, 8, formatBit(7))
  set(7, 8, formatBit(8))
  for (let i = 9; i < 15; i += 1) set(14 - i, 8, formatBit(i))
  for (let i = 0; i < 8; i += 1) set(size - 1 - i, 8, formatBit(i))
  for (let i = 8; i < 15; i += 1) set(8, size - 15 + i, formatBit(i))
  set(8, size - 8, true)
  let bitIndex = 0
  let upward = true
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right -= 1
    for (let vert = 0; vert < size; vert += 1) {
      const y = upward ? size - 1 - vert : vert
      for (let j = 0; j < 2; j += 1) {
        const x = right - j
        if (reserved[y][x]) continue
        const bit = bitIndex < codewords.length * 8
          ? ((codewords[bitIndex >>> 3] >>> (7 - (bitIndex & 7))) & 1) !== 0
          : false
        bitIndex += 1
        matrix[y][x] = bit !== ((x + y) % 2 === 0)
      }
    }
    upward = !upward
  }
  return matrix
}

export function qrSvg(text: string): string {
  const matrix = qrMatrix(text)
  const quiet = 4
  const size = matrix.length + quiet * 2
  const paths: string[] = []
  for (let y = 0; y < matrix.length; y += 1) for (let x = 0; x < matrix.length; x += 1) {
    if (matrix[y][x]) paths.push(`M${x + quiet},${y + quiet}h1v1h-1z`)
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><path d="${paths.join('')}" fill="#000"/></svg>`
}
