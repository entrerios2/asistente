/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				// Paleta de alto contraste para visibilidad proactiva
				brand: {
					black: '#000000',
					white: '#ffffff',
					accent: '#ff3e00' // Svelte orange but high contrast
				}
			}
		}
	},
	plugins: []
};
