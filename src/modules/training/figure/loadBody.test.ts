import type { FigureBody, FigurePalette } from './body';
import type * as Contract from './contract';
import type { FigureVariant } from './contract';

interface AssetState {
  registered: Partial<Record<FigureVariant, string>>;
  load: 'ok' | 'missing' | 'broken';
  requested: string[];
}

/** Which variants have an asset in this test, and how loading it ends. */
const assets: AssetState = vi.hoisted(() => ({ registered: {}, load: 'ok', requested: [] }));

vi.mock('./contract', async (original) => ({
  ...(await original<typeof Contract>()),
  figureAssetFor: (variant: FigureVariant) => assets.registered[variant] ?? null,
}));

vi.mock('./gltfBody', () => ({
  loadGltfBody: (url: string): Promise<FigureBody> => {
    assets.requested.push(url);
    if (assets.load === 'missing') return Promise.reject(new Error('404'));
    if (assets.load === 'broken') return Promise.reject(new Error('contract'));
    return Promise.resolve({ source: 'asset', clip: 'rest' } as FigureBody);
  },
}));

const { loadBody } = await import('./figureRenderer');

const options = {
  clip: 'horizontalPush_bench',
  highlight: {},
  palette: { accent: '#557a5b' } as FigurePalette,
};

describe('body selection', () => {
  beforeEach(() => {
    assets.registered = {};
    assets.load = 'ok';
    assets.requested = [];
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the fallback body while no asset is bundled', async () => {
    const body = await loadBody('female', options);
    expect(body.source).toBe('fallback');
    expect(body.clip).toBe('horizontalPush_bench');
    expect(assets.requested).toEqual([]);
  });

  it('loads the asset of the profile’s variant', async () => {
    assets.registered = { male: 'figure/kalethra-male.glb', female: 'figure/kalethra-female.glb' };
    expect((await loadBody('female', options)).source).toBe('asset');
    expect((await loadBody('male', options)).source).toBe('asset');
    // Resolved against the app's base, so a deep route (/training/…) still finds the file.
    expect(assets.requested).toEqual([
      `${import.meta.env.BASE_URL}figure/kalethra-female.glb`,
      `${import.meta.env.BASE_URL}figure/kalethra-male.glb`,
    ]);
  });

  it.each(['missing', 'broken'] as const)(
    'falls back when the asset is %s – no error',
    async (load) => {
      assets.registered = { male: 'figure/kalethra-male.glb' };
      assets.load = load;
      const body = await loadBody('male', options);
      expect(body.source).toBe('fallback');
      expect(console.warn).toHaveBeenCalled();
    },
  );

  it('keeps the variants independent: one variant’s asset is not used for the other', async () => {
    assets.registered = { female: 'figure/kalethra-female.glb' };
    expect((await loadBody('male', options)).source).toBe('fallback');
    expect(assets.requested).toEqual([]);
  });
});
