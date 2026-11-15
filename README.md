# Bala weds Gaja: Wedding Website

A responsive, cinematic, image-led wedding invitation built with plain HTML, CSS and JavaScript. No build step and no external animation library.

## Preview

Open `index.html` in a browser, or use VS Code Live Server for the smoothest preview.

## Current content

The website tells the story in 15 chapters, in this order:

1. BALAJI & GAJAPRIYA (opening)
2. "They say, two parallel paths never intersect." / Our story goes like...
3. The Bride: Gajapriya P
4. Gajapriya, The Art of Finding Her Way, with an automatic photo carousel (11 photographs)
5. The Groom: Balaji M
6. Balaji, The Unplanned Storyteller, with an automatic photo carousel (12 photographs)
7. "Miles apart, they got to know each other one call and one conversation at a time..."
8. They got engaged, on 14th September 2026
9. The Promise: And now they are ready to tie the knot.
10. Save the Date: Wednesday, 20 January 2027, 10:00 AM onwards, with an Add to Google Calendar button
11. Cauvery Mahal, Trichy Main Road, Ariyalur, with an embedded map, a Google Maps link and railway station distances
12. Live countdown to the wedding
13. Come and be a part of our story, your presence is our blessing
14. With love: family names and places
15. We are all set to start our journey towards togetherness... (with a Back to the Top button)

## Motion and navigation

Moving from one chapter to the next plays a single, directed transition. It is the same on desktop and mobile, so the website feels the same on every device.

1. The text of the current chapter fades and lifts away.
2. The next photograph opens over it with a soft, rounded wipe while the outgoing chapter darkens and drifts back slightly.
3. The new photograph settles with a slow cinematic push-in that continues while the chapter is on screen.
4. Once the photograph has landed, the new text fades in line by line.

Going backwards plays the same transition in the opposite direction.

- One chapter changes at a time. Fast scrolling, repeated taps or a trackpad flick cannot skip chapters.
- Desktop: mouse wheel and trackpad, the Back / Continue controls, and the keyboard (Arrow keys, Page Up / Page Down, Space, Home and End).
- Mobile: swipe up or down anywhere, plus the Back / Continue controls. Swipes that start on a scrolling text panel scroll that panel first, and the photo carousels still swipe sideways.
- The side progress line and the counter move with each chapter.
- The next chapter's photograph is loaded in advance, and chapters further away are not downloaded until needed, which keeps the first load light on mobile data.
- The website guides itself forward every nine seconds until the visitor first scrolls, taps or presses a key. After that, control stays with the visitor.
- If the visitor has asked their device for reduced motion, or the browser cannot run the transitions, the website falls back to ordinary scrolling with simple reveals.

### Tuning the transitions

All timings are in the `T` object near the top of `script.js` (milliseconds):

- `wipe`: how long the photograph takes to open.
- `wipeDelay`: how long the outgoing text has to leave before the photograph starts to open.
- `copyAt`: when the new text begins, counted from the start of the transition.
- `stagger` and `child`: the gap between lines of text and how long each line takes to appear.
- `cooldown`: quiet time before the next change is accepted.
- `drift`: the length of the slow push-in on each photograph.

The look of the effect (wipe shape, darkening, easing) is set in the same file, in the `transitionTo` function. The text fade is in the last section of `styles.css`, headed "Cinematic page transitions".

## Calendar

The Add to Google Calendar button opens a pre-filled Google Calendar event for 20 January 2027 at 10:00 AM IST. The default length is four hours and can be changed in `script.js`.

## Customising

- Replace images in `assets/images/` while keeping the filenames, or update image paths in `index.html`.
- Adjust the crop position of a photograph using the `data-position` attribute or the CSS `--mobile-position` variable for a scene.
- Edit text directly in `index.html`.
- Adjust colours, typography and responsive layout in `styles.css`.
- The wedding date and venue constants are also documented in `content.js`.
- If chapters are added or removed in `index.html`, update the "/ 15" labels in the chapter counters as well.

## Publish with GitHub Pages

Upload the contents of this folder to the root of a GitHub repository. In repository Settings → Pages, select Deploy from a branch, choose `main` and `/(root)`, then save.


## Guestbook integration
The public guestbook is configured in `guestbook.js` with the Supabase Project URL, publishable key, `submit-guestbook` Edge Function and Cloudflare Turnstile site key. The service-role key and Turnstile secret must remain in Supabase Edge Function secrets only.

For live wish updates, enable Realtime for `public.guestbook_wishes` in Supabase. The public read policy should allow SELECT only where `is_visible = true`. The `submit-guestbook` Edge Function validates Turnstile and writes wishes using its server-side service-role key.

The private admin dashboard and its admin-only UPDATE/DELETE policies are a separate protected setup step; do not expose any service-role credentials in this static website.

## Private guestbook admin
Open `/admin.html` on the deployed site and sign in with the Supabase Auth email/password for the admin user. Before using it, run `guestbook-admin-policies.sql` in the Supabase SQL Editor and confirm your auth user UUID is present in `public.guestbook_admins`. The page supports hiding/restoring, permanent deletion, search and CSV export. It is protected by Supabase Auth and row-level security; the URL itself is not the security boundary.
