# Sun Dream Yacht Charters: concept brief

**Idea:** An evening aboard, told by the sky. The hero is a real-time 3D sea at golden hour. As you scroll, the clock in the corner advances from 5:30 PM, the sun sets, a yacht crosses in front of it, and the night comes up with shoreline lights and stars. The contact form sits over the same sea at night.

**Why it suits them:** What they sell is a sunset on the Intracoastal with dinner. Their current site never shows it.

## What is on the page
1. Hero with the live sea
2. "A sample evening" timeline, five stops, driven by scroll
3. Fleet finder: drag the guest count and the right yacht is selected
4. Occasions list with photos that follow the cursor
5. Dining, family ownership, reviews
6. Quote request form

## Real, taken from their site or Google
- Yacht names, lengths, guest capacities, deck and salon sizes, features
- Family-owned since 1979, owner-direct with no broker fees, boarding at DoubleTree by Hilton GalleryOne, reply within 24 hours
- Phone numbers and address
- All four reviews (lightly trimmed for length)
- Every photo

## Assumed, needs the client to confirm
- The timeline times (5:30, 6:00, 7:10, 7:45, 9:00) are illustrative.
- "Brantmeyer family" comes from their page description and email address.
- Catalina's minimum group size is not published. The chart starts its bar around 150.
- The wordmark and sun icon are stand-ins for their logo.
- The form does not send anywhere yet.

## Tech
Static HTML, CSS and one JavaScript file. The sea is a single fragment shader running through three.js. It lowers its own resolution on slow devices and pauses when off screen. It honours the reduced-motion setting.
