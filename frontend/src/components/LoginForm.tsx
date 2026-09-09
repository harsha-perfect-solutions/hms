import React, { useState } from 'react';
import { User, AlertCircle } from 'lucide-react';
import { PasswordInput } from './PasswordInput';
import { useAuth } from '../context/AuthContext';

interface LoginFormProps {
  onSuccess?: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSuccess }) => {
  const { login } = useAuth();

  const [jntuNo, setJntuNo] = useState('');
  const [password, setPassword] = useState('');

  const [fieldErrors, setFieldErrors] = useState<{ jntuNo?: string; password?: string }>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleJntuChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setJntuNo(e.target.value);
    if (fieldErrors.jntuNo) {
      setFieldErrors((prev) => ({ ...prev, jntuNo: undefined }));
    }
    if (generalError) setGeneralError(null);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value); // Never trim password
    if (fieldErrors.password) {
      setFieldErrors((prev) => ({ ...prev, password: undefined }));
    }
    if (generalError) setGeneralError(null);
  };

  const validateForm = () => {
    const errors: { jntuNo?: string; password?: string } = {};

    const trimmedJntu = jntuNo.trim();
    if (!trimmedJntu) {
      errors.jntuNo = 'Please enter your JNTU number.';
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

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const trimmedJntu = jntuNo.trim();
      const result = await login(trimmedJntu, password);

      if (result.success) {
        if (onSuccess) onSuccess();
      } else {
        setGeneralError(result.message || 'Invalid JNTU No. or password.');
      }
    } catch {
      setGeneralError('Unable to sign in right now. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="login-form" onSubmit={handleSubmit} noValidate>
      {/* Global error banner */}
      {generalError && (
        <div className="alert-banner error" role="alert" aria-live="polite">
          <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>{generalError}</span>
        </div>
      )}

      {/* JNTU No. Field */}
      <div className="form-group">
        <label htmlFor="jntuNo" className="form-label">
          JNTU No.
        </label>
        <div className="form-input-wrapper">
          <span className="input-icon-left" aria-hidden="true">
            <User size={18} />
          </span>
          <input
            id="jntuNo"
            name="jntuNo"
            type="text"
            value={jntuNo}
            onChange={handleJntuChange}
            placeholder="Enter your JNTU number"
            disabled={isSubmitting}
            autoComplete="username"
            autoCapitalize="characters"
            spellCheck="false"
            className={`form-input ${fieldErrors.jntuNo ? 'has-error' : ''}`}
            aria-describedby={fieldErrors.jntuNo ? 'jntuNo-error' : undefined}
            aria-invalid={!!fieldErrors.jntuNo}
          />
        </div>
        {fieldErrors.jntuNo && (
          <div id="jntuNo-error" className="field-error-msg" role="alert">
            <AlertCircle size={14} />
            <span>{fieldErrors.jntuNo}</span>
          </div>
        )}
      </div>

      {/* Password Field */}
      <div className="form-group">
        <label htmlFor="password" className="form-label">
          Password
        </label>
        <PasswordInput
          id="password"
          name="password"
          value={password}
          onChange={handlePasswordChange}
          placeholder="Enter your password"
          disabled={isSubmitting}
          error={fieldErrors.password}
          aria-describedby={fieldErrors.password ? 'password-error' : undefined}
        />
        {fieldErrors.password && (
          <div id="password-error" className="field-error-msg" role="alert">
            <AlertCircle size={14} />
            <span>{fieldErrors.password}</span>
          </div>
        )}
      </div>

      {/* Primary Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="btn-submit"
        aria-label={isSubmitting ? 'Signing in' : 'Login'}
      >
        {isSubmitting ? (
          <>
            <span className="spinner" aria-hidden="true" />
            <span>Signing in...</span>
          </>
        ) : (
          <span>Login</span>
        )}
      </button>
    </form>
  );
};
