# Auction deck

Turns a Microsoft Forms sports-registration export into auction slides: title, Meet your captains,
then the girls and boys, one player per slide. Present it in the browser or download a .pptx or PDF.

Everything runs in the browser. The sheet and photos are never uploaded anywhere.

## Files

- `index.html` – the whole site in one file. This is the only file you need to host.
- `src/app.html` – page, styles and app code (slides, themes, exports).
- `src/core.js` – reading the sheet: cleaning names, phone numbers and experience, finding duplicates, matching photos.
- `build.js` – rebuilds `index.html` after you edit anything in `src/`.

## Live Website

👉 **[https://shivikadhawan.github.io/intras-auction/](https://shivikadhawan.github.io/intras-auction/)**

## Edit it

1. Change `src/app.html` or `src/core.js`.
2. Run `node build.js` (needs Node.js).
3. Upload the new `index.html`.

## Using it

1. **Files**: drop the Forms export (.xlsx or .csv) and the photos. Forms keeps photos in the form
   owner's OneDrive under Apps › Microsoft Forms › [form] › Question; download that folder as a .zip.
   Photos are matched by file name, so don't rename them.
2. **Check**: counts, players without photos, possible duplicate submissions.
3. **Look**: sport, theme, event name, date, phone numbers on or off.
4. **Order**: which group comes first, and the order of players inside each group
   (sheet, A–Z, Z–A, by cohort, random, or drag slides into your own order).
5. **Captains**: names, team names and photos for the Meet your captains slide.

Column names are detected automatically; fix them under Column mapping if a form uses different headings.

Libraries load from cdnjs/jsDelivr: SheetJS, JSZip, PptxGenJS, jsPDF, pdf.js (photos sent as PDF), heic2any (iPhone photos).
