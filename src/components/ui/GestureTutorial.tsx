import { useState, useEffect } from 'react';

export function GestureTutorial() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const hasSeenTutorial = localStorage.getItem('hasSeenGestureTutorial');
    if (!hasSeenTutorial) {
      setShow(true);
    }
  }, []);

  function handleDismiss() {
    localStorage.setItem('hasSeenGestureTutorial', 'true');
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-gray-800 rounded-2xl p-6 max-w-md mx-4 shadow-2xl border border-gray-700 animate-in zoom-in-95 duration-300">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Mobile Gestures</h2>
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-white">Swipe Right</h3>
              <p className="text-sm text-gray-400">Add to your plan to watch list</p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-12 h-12 bg-primary-500/20 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-white">Swipe Left</h3>
              <p className="text-sm text-gray-400">Mark as completed</p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-12 h-12 bg-primary-500/20 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-white">Long Press</h3>
              <p className="text-sm text-gray-400">Open quick action menu</p>
            </div>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          className="w-full mt-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors"
        >
          Got it!
        </button>
      </div>
    </div>
  );
}
