import { forwardRef } from 'react'
import { motion } from 'framer-motion'

const Card = forwardRef(({
    children,
    hover = false,
    active = false,
    glow = false,
    glass = false,
    className = '',
    style = {},
    ...props
}, ref) => {
    const baseStyle = glass ? {
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(20px) saturate(160%)',
        WebkitBackdropFilter: 'blur(20px) saturate(160%)',
        border: '1px solid var(--glass-border)',
    } : {
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-border-subtle)',
    }

    const activeStyle = active ? {
        borderColor: 'var(--color-accent)',
        boxShadow: 'var(--shadow-glow), 0 0 0 1px var(--color-accent)',
    } : {}

    return (
        <motion.div
            ref={ref}
            whileHover={hover ? {
                y: -4,
                boxShadow: 'var(--shadow-md), var(--shadow-glow)',
                borderColor: 'var(--color-border-strong)',
            } : {}}
            transition={{ duration: 0.2 }}
            className={`
        rounded-2xl p-5 shadow-sm
        ${hover ? 'cursor-pointer' : ''}
        ${glow ? 'anim-glow' : ''}
        ${className}
      `}
            style={{ ...baseStyle, ...activeStyle, ...style }}
            {...props}
        >
            {children}
        </motion.div>
    )
})

Card.displayName = 'Card'

export default Card
