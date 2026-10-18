# Spoor - wildlife identification website

## Files
```
wildlife_site/
  index.html
  css/style.css
  js/app.js
  server_stub.py     (test server; replace with your real model later)
```

## Run in NetBeans
1. File > New Project > **HTML5/JavaScript > HTML5/JS Application** (if missing: Tools > Plugins > Available Plugins > install "HTML/JS Application"; on newer NetBeans use **Java with Ant/Maven > HTML5/JS** or just open the folder as a Web project).
2. Choose **Site Root = the `wildlife_site` folder** (or copy the files into the project's Site Root).
3. Right-click `index.html` > **Run File**. NetBeans opens it in your browser (Chrome with the NetBeans integration, or any browser).

You can also just double-click `index.html`; it works without NetBeans.

## Run the server (separate terminal)
```
pip install flask flask-cors pillow
python server_stub.py
```
The page header should change to **Server online**. If the server is not running, the page shows "Server offline" and an error when you try to identify a photo.

## Connect your real model
Edit `predict_image()` in `server_stub.py` (or your own Flask app). The reply must be JSON:
```
{"identified": true, "species": "lion", "individual_id": "L-014", "confidence": 0.91}
```
- `identified` true = matched a known individual; false = new individual (`new_individual: true` if enrolled).
- `species` null = animal not recognised.
- Optional `"iucn_status": "VU"` (CR, EN, VU, NT, LC, DD) overrides the table in `js/app.js`.

## Check before submitting
The conservation statuses in `SPECIES_STATUS` (js/app.js) are from general knowledge. Verify each against https://www.iucnredlist.org. Some species have subspecies-level or regional assessments (for example African elephants are split into savanna and forest).
