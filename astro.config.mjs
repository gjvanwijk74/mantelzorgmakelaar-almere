import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://mantelzorgmakelaar-almere.nl',
  trailingSlash: 'always',
  // The CSS is tiny (a few KiB), so inline it instead of loading it as
  // render-blocking files.
  build: { inlineStylesheets: 'always' },
  integrations: [sitemap()],
});
