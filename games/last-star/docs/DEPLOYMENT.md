# Live website release

Public game: https://justaskjohnny.com/last-star/
Homepage: https://justaskjohnny.com/ (Arcade / more worlds)

Production repository: https://github.com/johnswaffles/johnny-chat
Branch: main
Source: games/last-star/
Published route: public/last-star/
Build: CF_PAGES=1 npm run build:pages
Verification: node scripts/verify-pages-build.mjs

The website build copies the game’s HTML, stylesheet, src, assets and two opt-in browser QA modules into the published route. Develop here, then synchronize reviewed game changes into the production repository's games/last-star source. A push to main triggers the existing Cloudflare Pages deployment. Verify the homepage link and actual live gameplay after each release.

Initial release commit: 3d0560245cf82ba67f40adf2150a04c2570a0d5c
Release marker: 20260925-arcade-live1
