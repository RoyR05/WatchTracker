interface AddToListModalProps {
  isOpen: boolean;
  onClose: () => void;
  tmdbId: number;
  mediaType: string;
  title: string;
}

export function AddToListModal({ isOpen, onClose, tmdbId: _tmdbId, mediaType: _mediaType, title }: AddToListModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-white mb-4">Add "{title}" to List</h2>
        <p className="text-gray-400 mb-4">List management coming soon</p>
        <button
          onClick={onClose}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}
