/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,html}',
    './Tests/**/*.{html,mht}'
  ],

  // Enable class-based dark mode so the app can toggle theme at runtime
  darkMode: 'class',

  corePlugins: {
    preflight: false
  },

  safelist: [
    /* Typography */
    'font-sans',
    'text-xs',
    'text-sm',
    'text-base',
    'text-lg',
    'text-xl',
    'font-normal',
    'font-medium',
    'font-semibold',
    'font-bold',

    /* Spacing */
    'mt-0',
    'mt-1',
    'mt-2',
    'mt-3',
    'mt-4',
    'mt-6',
    'mb-0',
    'mb-1',
    'mb-2',
    'mb-3',
    'mb-4',
    'mb-6',
    'pl-0',
    'pl-5',
    'pr-3',

    /* Lists */
    'list-inside',
    'list-outside',
    'list-decimal',
    'list-disc',

    /* Widths */
    'w-full',
    'w-48',

    /* Colors */
    'text-slate-900',
    'border-sky-500',
    'bg-sky-100',

    /* Visibility */
    'hidden',
    'block',

    /* Responsive layout utilities */
    'lg:grid-cols-12',
    'lg:col-span-5',
    'lg:col-span-7',
    'sm:hidden',
    'lg:hidden',
    'lg:block'
  ],

  theme: {
    extend: {
      /* Optional readability aliases */
      screens: {
        tablet: '640px',
        laptop: '1024px'
      }
    }
  },

  plugins: []
};