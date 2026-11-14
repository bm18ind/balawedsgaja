# Bala weds Gaja — Wedding Website

A responsive, cinematic, image-led wedding invitation built with plain HTML, CSS and JavaScript.

## Preview

Open `index.html` in a browser, or use VS Code Live Server for the smoothest preview.

## Current content

The website follows the 13-section sequence agreed with Balaji:

1. BALAJI & GAJAPRIYA
2. About Us
3. Gajapriya P — Customer Service Representative, Dubai
4. Balaji M — Assistant Professor, Mysuru
5. They only saw each other via calls until....
6. Engagement — 14 September 2026 (two photographs)
7. And now they are set to tie the knots.
8. Save the Date — Wednesday, 20 January 2027, 10:00 AM onwards
9. Cauvery Mahal, Trichy Main Road, Ariyalur; map and railway station distances
10. Live countdown
11. Come and be a part of our story, your presence is our blessing
12. Family names and places
13. We are all set to start our journey towards togetherness...

## Motion and navigation

- Each section reveals its photograph first. After approximately two seconds, the image softens and the text fades into view.
- Images use a slow cinematic zoom. Text is positioned in left, right or lower safe areas rather than directly over central subjects.
- Fixed Previous / Next controls navigate between sections; keyboard arrow and Page Up / Page Down navigation are also supported.
- The family photograph uses `object-fit: contain` so the complete group remains visible on mobile.
- Reduced-motion preferences are respected.

## Calendar

The Add to Calendar control offers a pre-filled Google Calendar event and an `.ics` file for Apple Calendar, Outlook and other calendar apps. The event is set for 20 January 2027 at 10:00 AM IST; the current default duration is four hours and can be changed in `script.js`.

## Customising

- Replace images in `assets/images/` while keeping the filenames, or update image paths in `index.html`.
- Adjust crop position using the `data-position` attribute or the CSS `--mobile-position` variable for a scene.
- Edit text directly in `index.html`.
- Adjust colours, typography, animation and responsive layout in `styles.css`.
- Wedding date and venue constants are also documented in `content.js`.

## Publish with GitHub Pages

Upload the contents of this folder to the root of a GitHub repository. In repository Settings → Pages, select Deploy from a branch, choose `main` and `/(root)`, then save.
