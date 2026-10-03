import { useState, type ReactNode } from 'react';
import { useI18n } from '@/core/i18n';
import type { BarcodeLookup, ExternalProduct, Food } from '@/core/nutrition';
import { scanBarcode } from '@/core/platform';
import { dismissKeyboard } from '@/ui';
import {
  BarcodeEntrySheet,
  BarcodeLookupSheet,
  BarcodeNotFoundSheet,
  CameraDeniedSheet,
} from './BarcodeSheets';
import { FoodFormSheet } from './FoodFormSheet';

type Step =
  | { kind: 'idle' }
  | { kind: 'entry'; notice?: string }
  | { kind: 'lookup'; barcode: string }
  | { kind: 'not-found'; barcode: string }
  | { kind: 'camera-denied' }
  | { kind: 'import'; product: ExternalProduct }
  | { kind: 'create'; barcode: string };

export interface BarcodeFlow {
  /** Opens the camera scanner (falls back to typing when there is no camera). */
  scan: () => Promise<void>;
  /** Opens the field to type a barcode. */
  enter: () => void;
  /** The current step as a sheet; `null` while no barcode step is open. */
  overlay: ReactNode;
}

/**
 * The one barcode flow – used by the food picker (logging, recipes, templates) and by the food
 * management in Einstellungen → Meine Inhalte. A known barcode is answered locally (offline);
 * an unknown one asks Open Food Facts, whose values are always reviewed in the food form before
 * anything is stored; without a match the user can create the food with the barcode. Offline
 * without a local match, the lookup sheet shows its error (`FoodLookupService.lookupBarcode`).
 */
export function useBarcodeFlow({
  onLocal,
  onSaved,
  createName = () => '',
}: {
  /** A food stored on this device has the barcode. */
  onLocal: (food: Food) => void;
  /** A reviewed product or a newly created food was stored. */
  onSaved: (food: Food) => void;
  /** Name prefilled when the user creates the food after "not found". */
  createName?: () => string;
}): BarcodeFlow {
  const { t } = useI18n();
  const [step, setStep] = useState<Step>({ kind: 'idle' });
  const close = () => {
    setStep({ kind: 'idle' });
  };

  async function scan() {
    dismissKeyboard();
    const outcome = await scanBarcode({
      instructions: t('nutrition.lookup.scanInstructions'),
      cancel: t('common.cancel'),
    });
    if (outcome.kind === 'scanned') setStep({ kind: 'lookup', barcode: outcome.code });
    else if (outcome.kind === 'denied') setStep({ kind: 'camera-denied' });
    else if (outcome.kind === 'unavailable') {
      setStep({ kind: 'entry', notice: t('nutrition.lookup.scannerUnavailable') });
    }
  }

  function handleLookup(result: BarcodeLookup) {
    if (result.kind === 'local') {
      close();
      onLocal(result.food);
    } else if (result.kind === 'external') setStep({ kind: 'import', product: result.product });
    else setStep({ kind: 'not-found', barcode: result.barcode });
  }

  const saved = (food: Food) => {
    close();
    onSaved(food);
  };

  let overlay: ReactNode = null;
  switch (step.kind) {
    case 'entry':
      overlay = (
        <BarcodeEntrySheet
          notice={step.notice}
          onSubmit={(barcode) => {
            setStep({ kind: 'lookup', barcode });
          }}
          onClose={close}
        />
      );
      break;
    case 'lookup':
      overlay = (
        <BarcodeLookupSheet
          barcode={step.barcode}
          onResult={handleLookup}
          onEnterManually={() => {
            setStep({ kind: 'entry' });
          }}
          onClose={close}
        />
      );
      break;
    case 'not-found':
      overlay = (
        <BarcodeNotFoundSheet
          barcode={step.barcode}
          onCreate={() => {
            setStep({ kind: 'create', barcode: step.barcode });
          }}
          onSearchByName={close}
          onClose={close}
        />
      );
      break;
    case 'camera-denied':
      overlay = (
        <CameraDeniedSheet
          onRetry={() => {
            close();
            void scan();
          }}
          onEnterManually={() => {
            setStep({ kind: 'entry' });
          }}
          onClose={close}
        />
      );
      break;
    case 'import':
      overlay = <FoodFormSheet product={step.product} onSaved={saved} onClose={close} />;
      break;
    case 'create':
      overlay = (
        <FoodFormSheet
          initialName={createName()}
          initialBarcode={step.barcode}
          onSaved={saved}
          onClose={close}
        />
      );
      break;
    case 'idle':
      break;
  }

  return {
    scan,
    enter: () => {
      setStep({ kind: 'entry' });
    },
    overlay,
  };
}
