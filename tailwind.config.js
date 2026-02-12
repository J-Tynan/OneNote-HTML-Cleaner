/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,html}',
    './Tests/**/*.{html,mht}'
  ],
  corePlugins: {
    preflight: false
  },
  safelist: [
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
    'list-inside',
    'list-outside',
    'list-decimal',
    'list-disc',
    'pl-0',
    'pl-5',
    'leading-6',
    'leading-7',
    'w-full',
    'w-48',
    'pr-3',
    'text-slate-900'
  ],
  theme: {
    extend: {}
  }
};
