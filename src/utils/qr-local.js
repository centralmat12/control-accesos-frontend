import QRCode from 'qrcode'

export async function dibujarQr(canvas, texto) {
  await QRCode.toCanvas(canvas, texto, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 220,
    color: { dark: '#0f172a', light: '#ffffff' },
  })
}
