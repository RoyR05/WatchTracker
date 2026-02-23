import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { resetPassword } = useAuth();
  const toast = useToast();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await resetPassword(email);

      if (error) {
        toast.error(error.message);
        return;
      }

      setEmailSent(true);
      toast.success('Password reset email sent');
    } catch (error) {
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  if (emailSent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="bg-gray-800 rounded-2xl shadow-2xl p-8 border border-gray-700 text-center">
            <div className="mb-6">
              <div className="mx-auto w-16 h-16 bg-green-600 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>

            <h1 className="text-2xl font-bold text-white mb-4">Check Your Email</h1>
            <p className="text-gray-400 mb-6">
              We've sent a password reset link to <span className="text-white font-medium">{email}</span>.
              Click the link in the email to reset your password.
            </p>

            <div className="space-y-3">
              <Link
                to="/login"
                className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-all"
              >
                Back to Sign In
              </Link>

              <button
                onClick={() => setEmailSent(false)}
                className="block w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg transition-all"
              >
                Try Different Email
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-gray-800 rounded-2xl shadow-2xl p-8 border border-gray-700">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Reset Password</h1>
            <p className="text-gray-400">Enter your email to receive a password reset link</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="you@example.com"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link to="/login" className="text-sm font-medium text-blue-500 hover:text-blue-400 transition-colors">
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
