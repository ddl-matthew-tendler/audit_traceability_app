/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        domino: {
          primary: '#3B3BD3',
          primaryHover: '#1820A0',
          secondarySurface: '#EDECFB',
          secondaryBorder: '#C9C5F2',
          secondaryText: '#1820A0',
          text: '#3F4547',
          textBody: '#7F8385',
          border: '#DBE4E8',
          success: '#28A464',
          warning: '#CCB718',
          error: '#C20A29',
          info: '#0070CC',
          bg: '#FAFAFA',
          container: '#FFFFFF',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Lato', 'Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        domino: '4px',
        'domino-lg': '8px',
      },
    },
  },
  plugins: [],
};
