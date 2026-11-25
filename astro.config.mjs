import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://mantelzorgmakelaar-almere.nl',
  trailingSlash: 'always',
  integrations: [sitemap()],
});
