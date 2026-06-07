import { forwardRef } from 'react'
import { motion } from 'framer-motion'

const variants = {
    primary: {
        background: 'var(--btn-primary-bg)',
        color: 'var(--btn-primary-text)',
        border: '1px solid var(--btn-primary-bg)',
        boxShadow: 'var(--btn-primary-shadow)',
    },
    secondary: {
        background: 'var(--btn-secondary-bg)',
        color: 'var(--btn-secondary-text)',
        border: '1px solid var(--btn-secondary-border)',
    },
    ghost: {
        background: 'transparent',
        color: 'var(--btn-ghost-text)',
        border: '1px solid transparent',
    },
    danger: {
        background: 'var(--btn-danger-bg)',
        color: 'var(--btn-danger-text)',
        border: '1px solid var(--btn-danger-bg)',
    },
}

const sizes = {
    sm: 'px-3 py-1.5 text-xs rounded-md gap-1.5',
    md: 'px-4 py-2 text-sm rounded-lg gap-2',
    lg: 'px-6 py-3 text-base rounded-xl gap-2.5',
    icon: 'p-2 rounded-lg',
}

const Button = forwardRef(({
    children,
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    className = '',
    ...props
}, ref) => {
    return (
        <motion.button
            ref={ref}
            whileHover={{ scale: disabled ? 1 : 1.02, y: disabled ? 0 : -1 }}
            whileTap={{ scale: disabled ? 1 : 0.98 }}
            transition={{ duration: 0.15 }}
            disabled={disabled || loading}
            className={`
        inline-flex items-center justify-center font-medium
        transition-all cursor-pointer
        disabled:opacity-50 disabled:cursor-not-allowed
        ${sizes[size]}
        ${className}
      `}
            style={variants[variant]}
            {...props}
        >
            {loading ? (
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : children}
        </motion.button>
    )
})

Button.displayName = 'Button'

export default Button
