export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        // RaineyFlixs red accent (mapped onto the existing `primary-*`
        // scale so every primary button / active state re-skins app-wide)
        primary: {
          50:  '#fdeaec',
          100: '#fbd5da',
          200: '#f4a7b0',
          300: '#ee7a87',
          400: '#e84c5e',
          500: '#E31E35',
          600: '#C8182D',
          700: '#A61224',
          800: '#7E0E1B',
          900: '#5C0A14',
        },
        // RaineyFlixs brand surface tokens
        brand: {
          bg:       '#111719',
          soft:     '#151b1f',
          card:     '#1B2227',
          charcoal: '#2F3A40',
          text:     '#F5F7F8',
          muted:    '#9AA3A9',
          red:      '#E31E35',
          'red-dark': '#A61224',
        },
      }
    },
  },
  plugins: [],
}
