import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist', // The folder where the built files will go
    rollupOptions: {
      input: {
        main: 'index.html',
        profile: 'profile.html',
        terms: 'terms-and-conditions.html',
        privacy: 'privacy-policy.html',
        view: 'view.html',
        action: 'action.html',
        team: 'team.html'
      }
    }
  },
  server: {
    // This will proxy your Netlify functions so you can test them locally
    proxy: {
      '/.netlify/functions': {
        target: 'http://localhost:8888',
        changeOrigin: true,
      }
    }
  }
});
