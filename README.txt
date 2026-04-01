tri2max Marketing Website
========================

Official marketing site for tri2max.app.

Brand direction
- Human-crafted, AI-supported
- Training that adapts to your life

Project structure
- index.html: Primary conversion landing page
- site.css: Shared design system and section styles
- site.js: Navigation, smooth scrolling, reveal animations, waitlist UX
- assets/icons/brand/tri2max_logo_white.png: Alternate logo for dark backgrounds
- assets/images/screenshot.png: Product screenshot used in the preview section
- assets/icons/brand/logo_cloud.png: Lightweight showcase visual

Design and implementation notes
- Mobile-first layout with desktop refinements
- Minimal, high-contrast visual style with restrained accent color (#C2401F)
- Semantic HTML sections for accessibility and maintainability
- Lightweight animation approach (IntersectionObserver + CSS transitions)
- No frontend framework required
- Performance-focused asset set with removed legacy template files

Local development
1. Open `index.html` directly in a browser, or
2. Serve with any static server (recommended):
   - Python: `python -m http.server 8080`
   - Node: `npx serve .`

Content updates
- Update section copy directly in `index.html`
- Tune spacing, colors, and components in `site.css`
- Adjust reveal timing and menu behavior in `site.js`
