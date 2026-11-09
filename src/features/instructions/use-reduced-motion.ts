import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(
      (value) => {
        if (live) setReduced(value);
      },
      () => {
        /* Keep the conservative reduced-motion default if unavailable. */
      }
    );
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      live = false;
      subscription.remove();
    };
  }, []);
  return reduced;
}
