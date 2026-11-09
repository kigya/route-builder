import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Keyboard, KeyboardAvoidingView } from 'react-native';

/** Match Android keyboard visibility rather than treating its hidden screenY as an inset. */
export function KeyboardScreen({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(() => Keyboard.isVisible());
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return (
    <KeyboardAvoidingView behavior="height" enabled={visible} style={{ flex: 1 }}>
      {children}
    </KeyboardAvoidingView>
  );
}
