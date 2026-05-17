/**
 * Branded full-screen loading / splash screen for RaineyFlixs.
 * Centered logo on the dark brand background with a subtle pulse + spinner.
 */
export function BrandSplash() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: '#111719' }}
    >
      <img
        src="/ui/splash-square-1024.png"
        alt="RaineyFlixs"
        className="w-40 h-40 sm:w-56 sm:h-56 object-contain rounded-3xl shadow-2xl animate-pulse"
      />
      <div className="mt-8 h-9 w-9 rounded-full border-2 border-white/15 border-t-primary-500 animate-spin" />
    </div>
  );
}
