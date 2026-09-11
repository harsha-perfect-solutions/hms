import React, { useState, forwardRef } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';

interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ error, className = '', disabled, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);

    const togglePasswordVisibility = () => {
      setShowPassword((prev) => !prev);
    };

    return (
      <div className="form-input-wrapper">
        <span className="input-icon-left" aria-hidden="true">
          <Lock size={18} />
        </span>
        
        <input
          {...props}
          ref={ref}
          type={showPassword ? 'text' : 'password'}
          disabled={disabled}
          autoComplete="current-password"
          className={`form-input password-input ${error ? 'has-error' : ''} ${className}`}
          aria-invalid={!!error}
        />

        <button
          type="button"
          tabIndex={0}
          onClick={togglePasswordVisibility}
          disabled={disabled}
          className="password-toggle-btn"
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          title={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? (
            <EyeOff size={18} aria-hidden="true" />
          ) : (
            <Eye size={18} aria-hidden="true" />
          )}
        </button>
      </div>
    );
  }
);

PasswordInput.displayName = 'PasswordInput';
