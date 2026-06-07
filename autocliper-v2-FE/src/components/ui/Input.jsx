import { forwardRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const Input = forwardRef(({
    label,
    icon,
    error,
    success,
    helperText,
    className = '',
    ...props
}, ref) => {
    const [focused, setFocused] = useState(false)

    const borderColor = error
        ? 'var(--color-error-text)'
        : success
            ? 'var(--color-success-text)'
            : focused
                ? 'var(--color-border-focus)'
                : 'var(--color-border-default)'

    return (
        <div className={`form-group ${className}`}>
            {label && (
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                    {label}
                </label>
            )}
            <div className="relative">
                {icon && (
                    <span
                        className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px]"
                        style={{ color: focused ? 'var(--icon-accent)' : 'var(--icon-muted)' }}
                    >
                        {icon}
                    </span>
                )}
                <motion.input
                    ref={ref}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    animate={{
                        boxShadow: focused ? '0 0 0 3px var(--color-accent-subtle)' : '0 0 0 0px transparent'
                    }}
                    transition={{ duration: 0.15 }}
                    className={`
            w-full py-2.5 px-3 rounded-lg outline-none
            text-sm font-medium
            transition-colors
            ${icon ? 'pl-10' : ''}
          `}
                    style={{
                        background: 'var(--color-bg-input)',
                        color: 'var(--color-text-primary)',
                        border: `1px solid ${borderColor}`,
                    }}
                    {...props}
                />
            </div>
            <AnimatePresence>
                {(error || helperText) && (
                    <motion.p
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="text-xs mt-1.5"
                        style={{ color: error ? 'var(--color-error-text)' : 'var(--color-text-muted)' }}
                    >
                        {error || helperText}
                    </motion.p>
                )}
            </AnimatePresence>
        </div>
    )
})

Input.displayName = 'Input'

export default Input
