import { useAuth } from '../contexts/AuthContext';

export default function PendingApprovalPage() {
  const { profile, signOut } = useAuth();

  const isRejected = profile?.approval_status === 'rejected';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 px-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-gray-800 rounded-lg shadow-xl p-8">
          {isRejected ? (
            <>
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-white mb-3">Access Denied</h1>
              <p className="text-gray-400 mb-6">
                Your account request has been denied by the administrator. If you believe this is an error, please contact the admin.
              </p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-amber-500/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-white mb-3">Awaiting Approval</h1>
              <p className="text-gray-400 mb-6">
                Your account is pending approval from the administrator. You will be able to access the app once approved.
              </p>
            </>
          )}

          <button
            onClick={signOut}
            className="w-full py-3 px-4 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
