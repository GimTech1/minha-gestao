// Gera os PNGs do app a partir de public/favicon.svg
import sharp from 'sharp'
const svg = 'public/favicon.svg'
for (const [file, size] of [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]]) {
  await sharp(svg).resize(size, size).flatten({ background: '#0b0b10' }).png().toFile(`public/${file}`)
}
console.log('ícones gerados')
