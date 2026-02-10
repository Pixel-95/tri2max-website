tri2max Marketing Website
========================

Official marketing site for tri2max.app.

Brand direction
- Human-crafted, AI-supported
- Training that adapts to your life

Project structure
- index.html: Primary conversion landing page
- generic.html: Supporting overview page
- elements.html: Early access information page
- assets/css/site.css: Shared design system and section styles
- assets/js/site.js: Navigation, smooth scrolling, reveal animations, waitlist UX
- images/tri2max_logo_black.png: Primary logo on light backgrounds
- images/tri2max_logo_white.png: Alternate logo for dark backgrounds

Design and implementation notes
- Mobile-first layout with desktop refinements
- Minimal, high-contrast visual style with restrained accent color (#C2401F)
- Semantic HTML sections for accessibility and maintainability
- Lightweight animation approach (IntersectionObserver + CSS transitions)
- No frontend framework required

Local development
1. Open `index.html` directly in a browser, or
2. Serve with any static server (recommended):
   - Python: `python -m http.server 8080`
   - Node: `npx serve .`

Content updates
- Update section copy directly in `index.html`
- Tune spacing, colors, and components in `assets/css/site.css`
- Adjust reveal timing and menu behavior in `assets/js/site.js`
