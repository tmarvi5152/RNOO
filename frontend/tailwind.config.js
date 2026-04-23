/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: ["./src/**/*.{js,jsx,ts,tsx}"],
    theme: {
        extend: {
                colors: {
                        border: 'hsl(var(--border))',
                        input: 'hsl(var(--input))',
                        ring: 'hsl(var(--ring))',
                        background: 'hsl(var(--background))',
                        foreground: 'hsl(var(--foreground))',
                        primary: {
                                DEFAULT: '#DE5E28',
                                foreground: '#FFFFFF',
                                hover: '#c75422',
                                active: '#b04a1e'
                        },
                        secondary: {
                                DEFAULT: '#222D32',
                                foreground: '#FFFFFF',
                                hover: '#353535'
                        },
                        accent: {
                                DEFAULT: '#20AFA8',
                                foreground: '#FFFFFF',
                                teal: '#20AFA8',
                                orange: '#DE5E28',
                                green: '#73C69F',
                                yellow: '#EBA233',
                                lime: '#7FC242',
                                cyan: '#8FC6C5',
                                peach: '#EE997C',
                                mint: '#ADDAC1',
                                gold: '#F3C989',
                                coral: '#DF6F73'
                        },
                        destructive: {
                                DEFAULT: 'hsl(var(--destructive))',
                                foreground: 'hsl(var(--destructive-foreground))'
                        },
                        muted: {
                                DEFAULT: 'hsl(var(--muted))',
                                foreground: 'hsl(var(--muted-foreground))'
                        },
                        popover: {
                                DEFAULT: 'hsl(var(--popover))',
                                foreground: 'hsl(var(--popover-foreground))'
                        },
                        card: {
                                DEFAULT: 'hsl(var(--card))',
                                foreground: 'hsl(var(--card-foreground))'
                        },
                        rpower: {
                                // Primary color palette from brand guide
                                header: '#222D32',
                                sidebar: '#161616',
                                text: '#353535',
                                'text-light': '#DDD',
                                'bg-light': '#BBB',
                                'bg-dark': '#3B3B3C',
                                'modal-light': '#DDD',
                                'modal-dark': '#161616',
                                'accent-light': '#E9E9E9',
                                'accent-dark': '#121212',
                                // Legacy colors
                                obsidian: '#222D32',
                                slate: '#161616',
                                orange: '#DE5E28',
                                teal: '#20AFA8'
                        },
                        semantic: {
                                success: '#73C69F',
                                warning: '#EBA233',
                                error: '#DF6F73',
                                info: '#20AFA8'
                        }
                },
                fontFamily: {
                        heading: ['"Roboto Condensed"', 'sans-serif'],
                        body: ['"Roboto Condensed"', 'sans-serif']
                },
                fontWeight: {
                        thin: '100',
                        normal: '400',
                        bold: '700'
                },
                borderRadius: {
                        lg: 'var(--radius)',
                        md: 'calc(var(--radius) - 2px)',
                        sm: 'calc(var(--radius) - 4px)'
                },
                keyframes: {
                        'accordion-down': {
                                from: { height: '0' },
                                to: { height: 'var(--radix-accordion-content-height)' }
                        },
                        'accordion-up': {
                                from: { height: 'var(--radix-accordion-content-height)' },
                                to: { height: '0' }
                        }
                },
                animation: {
                        'accordion-down': 'accordion-down 0.2s ease-out',
                        'accordion-up': 'accordion-up 0.2s ease-out'
                }
        }
    },
    plugins: [require("tailwindcss-animate")],
};