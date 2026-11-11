export default {
  darkMode: 'class', // ciemny motyw włączany klasą "dark" na <html> (dojdzie później)
  content: ['./index.html', './src/**/*.{ts,tsx}'], // Tailwind generuje tylko użyte klasy
  theme: { extend: {} },
  plugins: [],
};
