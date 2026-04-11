/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        brand: {
          green: '#10b981',
          'green-dim': '#0e2a1e',
        },
      },
    },
  },
  plugins: [],
};
