import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

const PasswordInput = ({
    value,
    onChange,
    placeholder = '••••••••',
    required = false,
    minLength,
    autoFocus = false,
    className = 'input-field',
    leftIcon = null,
    inputStyle = {},
    ...rest
}) => {
    const [showPassword, setShowPassword] = useState(false);

    return (
        <div className="password-input-wrapper">
            {leftIcon && <span className="password-left-icon">{leftIcon}</span>}
            <input
                type={showPassword ? 'text' : 'password'}
                className={className}
                required={required}
                minLength={minLength}
                autoFocus={autoFocus}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                style={{
                    ...(leftIcon ? { paddingLeft: '2.75rem' } : {}),
                    paddingRight: '2.75rem',
                    ...inputStyle
                }}
                {...rest}
            />
            <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(prev => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                title={showPassword ? 'Hide password' : 'Show password'}
            >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
        </div>
    );
};

export default PasswordInput;
