import { useEffect, type Dispatch, type SetStateAction } from 'react';

interface InstallState {
  installed: boolean;
  iosSafari: boolean;
}

interface UseInstallPromptEffectArgs {
  setDeferredInstallPrompt: Dispatch<SetStateAction<BeforeInstallPromptEvent | null>>;
  setInstallState: Dispatch<SetStateAction<InstallState>>;
}

export const useInstallPromptEffect = ({
  setDeferredInstallPrompt,
  setInstallState,
}: UseInstallPromptEffectArgs) => {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const standaloneMedia = window.matchMedia('(display-mode: standalone)');
    const computeInstallState = () => {
      const userAgent = window.navigator.userAgent;
      const isIos = /iPhone|iPad|iPod/i.test(userAgent)
        || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
      const isSafari = /Safari/i.test(userAgent)
        && !/Chrome|CriOS|Edg|OPR|Firefox|FxiOS|Android/i.test(userAgent);
      const installed = standaloneMedia.matches || window.navigator.standalone === true;
      setInstallState({
        installed,
        iosSafari: isIos && isSafari,
      });
      if (installed) {
        setDeferredInstallPrompt(null);
      }
    };

    const onBeforeInstallPrompt = (event: Event) => {
      const installEvent = event as BeforeInstallPromptEvent;
      installEvent.preventDefault();
      setDeferredInstallPrompt(installEvent);
      computeInstallState();
    };

    const onAppInstalled = () => {
      setDeferredInstallPrompt(null);
      computeInstallState();
    };

    computeInstallState();
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    standaloneMedia.addEventListener('change', computeInstallState);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
      standaloneMedia.removeEventListener('change', computeInstallState);
    };
  }, [setDeferredInstallPrompt, setInstallState]);
};
