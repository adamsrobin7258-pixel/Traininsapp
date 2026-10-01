const native = vi.hoisted(() => ({ scanBarcode: vi.fn() }));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android' },
  registerPlugin: () => native,
  CapacitorHttp: {},
}));

const { scanBarcode } = await import('./barcodeScanner');

const texts = { instructions: 'Barcode in den Rahmen halten', cancel: 'Abbrechen' };

describe('barcode scanner adapter', () => {
  beforeEach(() => {
    native.scanBarcode.mockReset();
  });

  it('scans with ZXing on Android and returns the code', async () => {
    native.scanBarcode.mockResolvedValue({ ScanResult: ' 4001234567890 ', format: 9 });
    expect(await scanBarcode(texts)).toEqual({ kind: 'scanned', code: '4001234567890' });
    expect(native.scanBarcode).toHaveBeenCalledWith(
      expect.objectContaining({
        hint: 17,
        scanInstructions: texts.instructions,
        android: { scanningLibrary: 'zxing' },
      }),
    );
  });

  it.each([
    [{ code: 'OS-PLUG-BARC-0006', message: 'cancelled' }, 'cancelled'],
    [{ code: 'OS-PLUG-BARC-0007', message: 'no camera' }, 'denied'],
    [{ code: 'OS-PLUG-BARC-0004', message: 'error' }, 'unavailable'],
  ])('maps plugin errors (%j)', async (error, kind) => {
    native.scanBarcode.mockRejectedValue(error);
    expect(await scanBarcode(texts)).toEqual({ kind });
  });

  it('treats an empty result as cancelled', async () => {
    native.scanBarcode.mockResolvedValue({ ScanResult: '', format: 0 });
    expect(await scanBarcode(texts)).toEqual({ kind: 'cancelled' });
  });
});
