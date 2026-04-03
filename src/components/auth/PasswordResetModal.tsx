import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';

interface PasswordResetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PasswordResetModal({ isOpen, onClose }: PasswordResetModalProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [rateLimitWait, setRateLimitWait] = useState(0);
  const emailInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && emailInputRef.current) {
      emailInputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (rateLimitWait > 0) {
      const timer = setInterval(() => {
        setRateLimitWait((prev) => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [rateLimitWait]);

  useEffect(() => {
    if (!isOpen) {
      setEmail('');
      setError('');
      setSuccess(false);
      setRateLimitWait(0);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!email.trim()) {
        throw new Error('Please enter your email address');
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error('Please enter a valid email address');
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        if (error.message.includes('rate limit')) {
          setRateLimitWait(60);
          throw new Error('Too many requests. Please wait 60 seconds before trying again.');
        }
        throw error;
      }

      setSuccess(true);
      setRateLimitWait(60);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !loading) {
      handleClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-labelledby="reset-password-title"
      aria-describedby="reset-password-description"
      aria-modal="true"
    >
      <div className="bg-gray-800 rounded-lg shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between">
          <h2
            id="reset-password-title"
            className="text-2xl font-bold text-white"
          >
            Reset Password
          </h2>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-gray-400 hover:text-white transition-colors p-1 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Close dialog"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {!success ? (
          <>
            <p
              id="reset-password-description"
              className="text-gray-300 text-sm leading-relaxed"
            >
              Enter your email address and we'll send you a link to reset your
              password. The link will expire in 60 minutes.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="reset-email"
                  className="block text-sm font-medium text-gray-300 mb-2"
                >
                  Email Address
                </label>
                <input
                  ref={emailInputRef}
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  placeholder="you@example.com"
                  required
                  disabled={loading}
                  aria-describedby={error ? 'reset-error' : undefined}
                  autoComplete="email"
                />
              </div>

              {error && (
                <div
                  id="reset-error"
                  className="bg-red-500/10 border border-red-500/50 rounded-lg p-3"
                  role="alert"
                >
                  <p className="text-red-400 text-sm">{error}</p>
                  {rateLimitWait > 0 && (
                    <p className="text-gray-400 text-xs mt-1">
                      Please wait {rateLimitWait} seconds before trying again.
                    </p>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  className="flex-1 py-3 px-4 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || rateLimitWait > 0}
                  className="flex-1 py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-gray-800"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg
                        className="animate-spin h-5 w-5"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Sending...
                    </span>
                  ) : rateLimitWait > 0 ? (
                    `Wait ${rateLimitWait}s`
                  ) : (
                    'Send Reset Link'
                  )}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-center w-16 h-16 mx-auto bg-green-500/10 rounded-full">
              <svg
                className="w-8 h-8 text-green-500"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-xl font-semibold text-white">
                Check Your Email
              </h3>
              <p className="text-gray-300 text-sm leading-relaxed">
                We've sent a password reset link to{' '}
                <span className="font-medium text-white">{email}</span>
              </p>
              <p className="text-gray-400 text-xs">
                The link will expire in 60 minutes. If you don't see the email,
                check your spam folder.
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={handleClose}
                className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-gray-800"
              >
                Done
              </button>
            </div>

            {rateLimitWait > 0 && (
              <p className="text-center text-gray-400 text-xs">
                You can request another reset link in {rateLimitWait} seconds
              </p>
            )}
          </div>
        )}

        <div className="pt-2 border-t border-gray-700">
          <p className="text-gray-400 text-xs text-center">
            Don't have email access?{' '}
            <a
              href="mailto:support@watchtracker.com"
              className="text-primary-400 hover:text-primary-300 underline focus:outline-none focus:ring-2 focus:ring-primary-500 rounded"
            >
              Contact support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
