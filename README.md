# PJ Store Modular Build

This folder splits the original single-file site into separate files:

- `index.html` for structure
- `styles.css` for all styling
- `data.js` for product data
- `secret-config.js` for update key and private config
- `app.js` for behavior and interactions

## Update key

`PJ-W9Y7-LBR9-6JQB-PAVI`

Important: this key is only hidden by file organization. In a browser-based static site, any loaded JavaScript can be viewed by visitors. For actual secrecy, keep the key server-side or in a private deployment workflow.

## Run it

Open `index.html` in a browser, or deploy the whole folder to GitHub Pages.

## Editing later

When you add new products or change existing ones:

1. Update `data.js`
2. Update `app.js` only if the logic changes
3. Keep `secret-config.js` in the same folder if your update workflow depends on the key
