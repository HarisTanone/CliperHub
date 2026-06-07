import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

function ThemeToggle() {
    const [theme, setTheme] = useState(() => {
        const saved = localStorage.getItem('theme')
        if (saved) return saved
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    })

    useEffect(() => {
        const root = document.documentElement
        if (theme === 'dark') {
            root.classList.add('dark')
        } else {
            root.classList.remove('dark')
        }
        localStorage.setItem('theme', theme)
    }, [theme])

    const toggle = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

    return (
        <motion.button
            onClick={toggle}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="relative w-10 h-10 rounded-xl flex items-center justify-center 
                       bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)]
                       border border-[var(--color-border-subtle)]
                       transition-colors cursor-pointer overflow-hidden"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
            <AnimatePresence mode="wait">
                <motion.span
                    key={theme}
                    initial={{ y: -30, opacity: 0, rotate: -90 }}
                    animate={{ y: 0, opacity: 1, rotate: 0 }}
                    exit={{ y: 30, opacity: 0, rotate: 90 }}
                    transition={{
                        duration: 0.3,
                        ease: [0.34, 1.56, 0.64, 1]
                    }}
                    className="material-symbols-outlined text-[20px]"
                    style={{ color: 'var(--icon-accent)' }}
                >
                    {theme === 'dark' ? 'light_mode' : 'dark_mode'}
                </motion.span>
            </AnimatePresence>

            {/* Glow effect */}
            <motion.div
                className="absolute inset-0 rounded-xl"
                style={{
                    background: theme === 'dark'
                        ? 'radial-gradient(circle, rgba(201,74,110,0.2) 0%, transparent 70%)'
                        : 'radial-gradient(circle, rgba(122,48,80,0.15) 0%, transparent 70%)'
                }}
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
        </motion.button>
    )
}

export default ThemeToggle
