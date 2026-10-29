// Small helpers shared by the home page elements.

export const motionOn = () => document.documentElement.classList.contains('motion');
export const desktop = () => window.matchMedia('(min-width: 990px)').matches;

export function webglAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

// The 3D desk is a large download: skip it with reduced motion, Save-Data or no WebGL.
export function canLoad3d() {
  const saveData = navigator.connection && navigator.connection.saveData;
  return !saveData && webglAvailable() && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function afterLoad(callback) {
  const idle = () => (window.requestIdleCallback || setTimeout)(callback, { timeout: 2000 });
  if (document.readyState === 'complete') idle();
  else window.addEventListener('load', idle, { once: true });
}
