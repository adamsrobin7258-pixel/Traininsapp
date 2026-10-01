import { registerPlugin } from '@capacitor/core';
import { isNativePlatform } from './platform';

/**
 * The native part of `@capacitor/barcode-scanner`, bound by its registered name. Importing the
 * package's JavaScript entry would also bundle its web scanner library (html5-qrcode), which
 * Kalethra never uses; the values below are the plugin's documented option constants.
 */
interface NativeBarcodeScanner {
  scanBarcode(options: {
    hint: number;
    scanInstructions?: string;
    scanButton?: boolean;
    cameraDirection?: number;
    scanOrientation?: number;
    cancelButtonAccessibilityLabel?: string;
    android?: { scanningLibrary?: 'zxing' | 'mlkit' };
  }): Promise<{ ScanResult: string; format: number }>;
}

const NativeScanner = registerPlugin<NativeBarcodeScanner>('CapacitorBarcodeScanner');

const OPTIONS = {
  /** CapacitorBarcodeScannerTypeHintALLOption.ALL */
  anyFormat: 17,
  /** CapacitorBarcodeScannerCameraDirection.BACK */
  backCamera: 1,
  /** CapacitorBarcodeScannerScanOrientation.ADAPTIVE */
  adaptiveOrientation: 3,
} as const;

export type BarcodeScanOutcome =
  | { kind: 'scanned'; code: string }
  | { kind: 'cancelled' }
  /** The user did not grant camera access. */
  | { kind: 'denied' }
  /** No scanner on this platform (web build) or the scanner failed. */
  | { kind: 'unavailable' };

export interface BarcodeScanTexts {
  instructions: string;
  cancel: string;
}

/**
 * Test hook for the web build: end-to-end tests define `window.__kalethraScanBarcode` to
 * simulate a scan, since a real camera is not available there. Never used on devices.
 */
interface ScanHookWindow {
  __kalethraScanBarcode?: () => Promise<BarcodeScanOutcome>;
}

/**
 * Opens the native barcode scanner (camera view with scan area, instructions and cancel).
 * The camera permission is requested by the scanner itself – only now, never at app start.
 * Android decodes with ZXing (on the device, no Google services involved), iOS with Apple
 * Vision. Food barcodes: EAN-13, EAN-8, UPC-A, UPC-E (the caller validates the format).
 */
export async function scanBarcode(texts: BarcodeScanTexts): Promise<BarcodeScanOutcome> {
  if (!isNativePlatform()) {
    const hook = (window as ScanHookWindow).__kalethraScanBarcode;
    return hook ? hook() : { kind: 'unavailable' };
  }
  try {
    const result = await NativeScanner.scanBarcode({
      hint: OPTIONS.anyFormat,
      scanInstructions: texts.instructions,
      scanButton: false,
      cameraDirection: OPTIONS.backCamera,
      scanOrientation: OPTIONS.adaptiveOrientation,
      cancelButtonAccessibilityLabel: texts.cancel,
      android: { scanningLibrary: 'zxing' },
    });
    const code = result.ScanResult.trim();
    return code ? { kind: 'scanned', code } : { kind: 'cancelled' };
  } catch (error) {
    return classify(error);
  }
}

/** Error codes of the plugin: OS-PLUG-BARC-0006 cancelled, -0007 camera access denied. */
function classify(error: unknown): BarcodeScanOutcome {
  const code =
    typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (code.endsWith('0006') || message.includes('cancel')) return { kind: 'cancelled' };
  if (
    code.endsWith('0007') ||
    message.includes('permission') ||
    message.includes('camera access')
  ) {
    return { kind: 'denied' };
  }
  return { kind: 'unavailable' };
}
