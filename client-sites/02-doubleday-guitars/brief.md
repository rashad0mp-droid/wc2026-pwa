# Doubleday Guitars: concept brief

**Idea:** Take the guitar apart. A 3D T-style guitar, modelled entirely in code, sits beside the headline. Scrolling pulls it into body, neck, pickups and finish, each with the real spec. Then a "Spec yours" panel recolours the same guitar live and writes the spec into an email to Walker.

**Why it suits them:** The product is choices: wood, neck carve, pickup wind, finish. The current site lists them as bullet points.

## What is on the page
1. Hero with the guitar (drag to turn it)
2. Anatomy in four chapters, driven by scroll
3. Spec yours: finish, pickguard, fretboard, body wood, neck profile, pickup wind
4. Recent builds, a draggable strip of their photography
5. Custom line versus Standard line
6. The maker
7. Ordering in four steps, reviews, repair bench

## Real, taken from their site or Google
- Slogan "We make 'em like they used to"
- All specs: one-piece swamp ash or alder, quarter-sawn maple, Soft V or Chunky C, the four radii, AlNiCo options, Kluson hardware, nitro finish
- Walker's background (Roberto-Venn, 2014)
- 50% deposit, five-year limited warranty
- Reviews, contact details, every photo

## Assumed, needs the client to confirm
- **Build time.** Their FAQ says "9-10 months" in one answer and "less than 6 months" in another. The concept says "under six months".
- Finish names "Oxblood" and "Lake Blue" are placeholders.
- "Often in stock and ready to ship" for the Standard line is inferred from their store page.
- Gallery captions describe what is visible in each photo, not model names.
- The 3D headstock is deliberately generic and carries no logo.

## Tech
Static HTML, CSS and one JavaScript file. The guitar is about 150 meshes built from shapes and extrusions in three.js, with procedural wood grain. No model files or textures are downloaded.
