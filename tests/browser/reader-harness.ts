import { createElement, useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { useFormReader } from '../../apps/extension/entrypoints/sidepanel/useFormReader.js';

declare global {
  interface Window {
    __readerHarness?: ReturnType<typeof useFormReader>;
    __unmountReader?: () => void;
  }
}

// Test entry only: mounts the real hook so pending promises can be delivered
// after React unmounts it, while the browser document stays alive.
function Harness() {
  const reader = useFormReader(7);
  useLayoutEffect(() => { window.__readerHarness = reader; });
  return createElement('pre', { id: 'connection' }, JSON.stringify(reader.connection));
}

const root = createRoot(document.getElementById('root')!);
window.__unmountReader = () => root.unmount();
root.render(createElement(Harness));
