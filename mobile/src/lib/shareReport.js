import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

function bytesToBase64(bytes) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triplet = (a << 16) | (b << 8) | c;
    out += chars[(triplet >> 18) & 63];
    out += chars[(triplet >> 12) & 63];
    out += i + 1 < bytes.length ? chars[(triplet >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? chars[triplet & 63] : '=';
  }
  return out;
}

function toUint8Array(data) {
  if (!data) return new Uint8Array();
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  if (typeof data === 'string') {
    const enc = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
    if (enc) return enc.encode(data);
  }
  return new Uint8Array(data);
}

/**
 * Save owner report binary and open the native share sheet.
 * @param {ArrayBuffer|Uint8Array} data
 * @param {'pdf'|'xlsx'} format
 */
export async function shareReportExport(data, format = 'xlsx') {
  const ext = format === 'pdf' ? 'pdf' : 'xlsx';
  const mime =
    format === 'pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const day = new Date().toISOString().slice(0, 10);
  const path = `${FileSystem.cacheDirectory}kulansiiye-report-${day}.${ext}`;
  const base64 = bytesToBase64(toUint8Array(data));
  await FileSystem.writeAsStringAsync(path, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error(`Faylka waa la kaydiyay: ${path}`);
  }
  await Sharing.shareAsync(path, {
    mimeType: mime,
    dialogTitle: 'Warbixinta E-Garoon',
    UTI: format === 'pdf' ? 'com.adobe.pdf' : 'org.openxmlformats.spreadsheetml.sheet',
  });
  return path;
}
