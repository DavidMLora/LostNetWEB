import QRCode from 'qrcode';

/**
 * URL fija de descarga para la app móvil de LostNet.
 * Apunta siempre al APK debug más reciente publicado en GitHub Releases.
 */
export const APP_APK_URL = 'https://github.com/AbrahamEsquivel/LostNet/releases/latest/download/app-debug.apk';

/**
 * Genera el código QR en formato SVG (en tiempo de build) apuntando a la URL indicada.
 */
export async function generateQrSvg(url: string = APP_APK_URL): Promise<string> {
  return await QRCode.toString(url, {
    type: 'svg',
    margin: 1,
    width: 180,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#1e293b', // slate-800
      light: '#ffffff',
    },
  });
}
