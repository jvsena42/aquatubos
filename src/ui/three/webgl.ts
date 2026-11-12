/**
 * True when the browser can create a WebGL context. three.js throws when it cannot (old
 * hardware, disabled GPU, test environments), so the 3D view checks first.
 */
export function isWebGLAvailable(): boolean {
  if (typeof window === 'undefined' || typeof window.WebGLRenderingContext === 'undefined') {
    return false;
  }
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (!context) return false;
    // Free the probe context: browsers limit how many can be alive.
    context.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}
