import { useEffect, useEffectEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { exitApp, onSystemBack } from '@/core/platform';
import { closeTopOverlay } from '@/ui';
import { backTarget, routePatterns } from '../backNavigation';
import { appModules } from '../modules';

const patterns = routePatterns(appModules);

/**
 * Connects the Android system back action to the app navigation: close the topmost sheet,
 * otherwise go one level up, and only at "Today" leave the app.
 */
export function SystemBackHandler() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const handleBack = useEffectEvent(() => {
    if (closeTopOverlay()) return;
    const target = backTarget(pathname, patterns);
    if (target === null) exitApp();
    else void navigate(target, { replace: true });
  });

  useEffect(
    () =>
      onSystemBack(() => {
        handleBack();
      }),
    [],
  );

  return null;
}
