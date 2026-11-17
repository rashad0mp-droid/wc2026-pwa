# Client website concepts

Five US leads found on Google Maps, three redesign concepts built.

## What is here

| Folder | What |
|---|---|
| `leads/leads.md` | The five businesses, why each was picked, contact details, what is wrong with the current site, and a pitch angle |
| `leads/leads.json` | Same data, structured |
| `leads/screenshots/` | "Before" screenshots of each current site |
| `leads/raw/` | Raw Google Maps search results and Google reviews |
| `01-sun-dream-yacht-charters/` | Concept site 1, plus `brief.md` |
| `02-doubleday-guitars/` | Concept site 2, plus `brief.md` |
| `03-3-creek/` | Concept site 3, plus `brief.md` |
| `_tools/` | Build and screenshot scripts |

## Viewing a site

Open `site/index.html` in Chrome, Edge, Safari or Firefox. No server or internet connection is needed. Fonts, images and the 3D code are all inside the `site` folder, so that folder can be uploaded as-is to Netlify, Vercel, Cloudflare Pages or any static host.

## Changing a site

- Text and layout: `site/index.html` and `site/assets/css/styles.css`. Edit and refresh.
- 3D and interactions: `src/*.js`. After editing, rebuild:

```
cd _tools && npm install        # once
cd .. && node _tools/build.mjs 01-sun-dream-yacht-charters
```

## How the leads were chosen

1. Searched Google Maps (through Firecrawl) in eight visual, high-ticket niches across affluent US metros: pool builders, furniture makers, car restoration, coffee roasters, home builders, landscape design, guitar makers, yacht charters. About 160 listings.
2. Kept businesses with a rating of 4.6 or higher, at least 40 reviews, and a website. Strong reviews mean real revenue and an owner who cares about reputation.
3. Opened each remaining site and looked for template tells: Wix or Squarespace defaults, placeholder links, stale copyright years, numbers that contradict each other.
4. Ranked by how much one new customer is worth to them. A yacht charter or a hardscape job pays for a $10,000 website with a single booking. A café does not.

## Before sending anything to a client

- Every site has a small "Design concept, not the live site" tag in the footer. Leave it until they sign.
- Photos are the client's own, pulled from their current website for the pitch. They would supply originals for a real build.
- Each `brief.md` lists the details that are assumptions and need the client to confirm.
- Contact forms are front-end only. They need connecting to email or a CRM in a real build.
