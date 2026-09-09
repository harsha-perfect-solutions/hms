import React, { useState } from 'react';
import { ShieldCheck, Lock, AlertCircle, User, ArrowLeft, Shield } from 'lucide-react';
import { PasswordInput } from '../components/PasswordInput';
import { useManagementAuth } from '../context/ManagementAuthContext';
import { APP_BRANDING } from '../config/branding';

interface ManagementLoginPageProps {
  onLoginSuccess: () => void;
  onNavigateToStudent: () => void;
}

export const ManagementLoginPage: React.FC<ManagementLoginPageProps> = ({
  onLoginSuccess,
  onNavigateToStudent,
}) => {
  const { login } = useManagementAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ identifier?: string; password?: string }>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleIdentifierChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIdentifier(e.target.value);
    if (fieldErrors.identifier) {
      setFieldErrors((prev) => ({ ...prev, identifier: undefined }));
    }
    if (generalError) setGeneralError(null);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (fieldErrors.password) {
      setFieldErrors((prev) => ({ ...prev, password: undefined }));
    }
    if (generalError) setGeneralError(null);
  };

  const validateForm = () => {
    const errors: { identifier?: string; password?: string } = {};

    const trimmed = identifier.trim();
    if (!trimmed) {
      errors.identifier = 'Please enter your management ID or username.';
    }

    if (!password) {
      errors.password = 'Password is required.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const result = await login(identifier.trim(), password);

      if (result.success) {
        onLoginSuccess();
      } else {
        setGeneralError(result.message || 'Invalid credentials or unauthorized role.');
      }
    } catch {
      setGeneralError('Unable to sign in right now. Please verify server connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-viewport management-auth-viewport">
      <div className="auth-container">
        {/* Left / Primary Panel: Management Administrative Showcase */}
        <section className="auth-branding-panel management-branding-panel" aria-label="Management Branding">
          <div className="brand-badge">
            <div className="brand-logo-icon management-badge-icon" aria-hidden="true">
              <Shield size={24} />
            </div>
            <div className="brand-logo-text">
              <span className="brand-name">{APP_BRANDING.appName}</span>
              <span className="brand-subtitle management-hero-badge">Hostel Administration & Oversight</span>
            </div>
          </div>

          <div className="brand-hero">
            <h1 className="brand-hero-title">
              Management Portal
            </h1>
            <p className="brand-hero-desc">
              Authoritative operational console for wardens and hostel administration. Monitor residential presence, room occupancy, and actionable requests.
            </p>

            <div className="brand-features">
              <div className="brand-feature-item">
                <span className="feature-check-icon" aria-hidden="true">
                  <ShieldCheck size={14} />
                </span>
                <span>Server-Side RBAC Enforcement (Warden / Admin)</span>
              </div>
              <div className="brand-feature-item">
                <span className="feature-check-icon" aria-hidden="true">
                  <ShieldCheck size={14} />
                </span>
                <span>Real-Time Biometric & Presence Intelligence</span>
              </div>
              <div className="brand-feature-item">
                <span className="feature-check-icon" aria-hidden="true">
                  <ShieldCheck size={14} />
                </span>
                <span>Authoritative Audit & Request Workflow Management</span>
              </div>
            </div>
          </div>

          <div className="brand-footer">
            <ShieldCheck size={16} aria-hidden="true" />
            <span>Strict Server-Verified Administrative Access</span>
          </div>
        </section>

        {/* Right Section: Management Login Form */}
        <section className="auth-form-panel" aria-label="Management Login Form">
          <div className="mobile-brand-header">
            <div className="mobile-logo-icon management-mobile-icon" aria-hidden="true">
              <Shield size={20} />
            </div>
            <div className="brand-logo-text">
              <span className="brand-name" style={{ color: 'var(--primary-navy)', fontSize: '1.1rem' }}>
                {APP_BRANDING.appName}
              </span>
              <span className="brand-subtitle" style={{ color: 'var(--text-muted)' }}>
                Management Console
              </span>
            </div>
          </div>

          <div className="form-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span className="role-badge-admin" style={{ fontSize: '0.75rem' }}>
                WARDEN / ADMIN
              </span>
            </div>
            <h2 className="form-title">Management Sign In</h2>
            <p className="form-subtitle">Enter your official administrative credentials to access operational controls.</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            {generalError && (
              <div className="alert-banner error" role="alert" aria-live="polite">
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{generalError}</span>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="management-identifier" className="form-label">
                Management ID / Username
              </label>
              <div className="form-input-wrapper">
                <span className="input-icon-left" aria-hidden="true">
                  <User size={18} />
                </span>
                <input
                  id="management-identifier"
                  name="identifier"
                  type="text"
                  value={identifier}
                  onChange={handleIdentifierChange}
                  placeholder="e.g. WARDEN01"
                  disabled={isSubmitting}
                  autoComplete="username"
                  autoCapitalize="characters"
                  spellCheck="false"
                  className={`form-input ${fieldErrors.identifier ? 'has-error' : ''}`}
                  aria-describedby={fieldErrors.identifier ? 'identifier-error' : undefined}
                  aria-invalid={!!fieldErrors.identifier}
                />
              </div>
              {fieldErrors.identifier && (
                <div id="identifier-error" className="field-error-msg" role="alert">
                  <AlertCircle size={14} />
                  <span>{fieldErrors.identifier}</span>
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="management-password" className="form-label">
                Password
              </label>
              <PasswordInput
                id="management-password"
                name="password"
                value={password}
                onChange={handlePasswordChange}
                placeholder="Enter administrative password"
                disabled={isSubmitting}
                error={fieldErrors.password}
                aria-describedby={fieldErrors.password ? 'mgmt-password-error' : undefined}
              />
              {fieldErrors.password && (
                <div id="mgmt-password-error" className="field-error-msg" role="alert">
                  <AlertCircle size={14} />
                  <span>{fieldErrors.password}</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-submit management-btn-submit"
              aria-label={isSubmitting ? 'Signing in' : 'Sign In as Management'}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner" aria-hidden="true" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <span>Access Management Console</span>
              )}
            </button>
          </form>

          <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
            <button
              type="button"
              onClick={onNavigateToStudent}
              className="btn-link"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.85rem',
                color: 'var(--primary-navy)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 500,
                padding: '4px 8px',
              }}
            >
              <ArrowLeft size={14} />
              <span>Back to Student Portal</span>
            </button>
          </div>

          <div className="auth-security-note">
            <Lock size={13} aria-hidden="true" />
            <span>Server-Authorized Access Only • Students Prohibited (403)</span>
          </div>
        </section>
      </div>
    </main>
  );
};
