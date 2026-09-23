SF SYMBOLS 27 - OFFICIAL-ONLY SITE

SOURCE POLICY
- The catalog and SVG assets in this build come from the recovered Apple SF Symbols 27 package data.
- No missing icon is fabricated. The 21 catalog names whose official SVG was not recovered remain listed without replacement artwork.
- No unsupported animation is simulated.
- Original SVG downloads always use assets/symbols/*.svg.

RUNNABLE VERIFIED EFFECTS IN THIS BUILD
- Bounce Up / Bounce Down: recovered Apple binary recipe.
- Pulse: recovered Apple recipe; recovered per-symbol pulse layer targets are used when the structured SVG is available.
- Breathe / Breathe + Pulse: recovered Apple whole-symbol recipe.
- Wiggle: exposed only for the 329 symbols with recovered explicit rotational direction metadata and the recovered Apple rotation recipe.

INTENTIONALLY BLOCKED UNTIL AN EXACT OFFICIAL RENDERER IS RECOVERED
- Rotate: exact per-symbol anchor coordinates are still unresolved.
- Wiggle Translation: exact coordinate-to-render-size mapping is still unresolved.
- Draw / Variable Draw: exact clip-stroke runtime data is still unresolved.
- Magic Replace: exact symbol-pair matching is still unresolved.

RUNNING ON WINDOWS
1. Right-click start.ps1 and run with PowerShell, or execute .\start.ps1 from PowerShell.
2. The site opens at http://localhost:8000.
3. Keep the PowerShell window open while using the site.

This local HTTP server is used so the browser can load the recovered layered SVG files for exact layer-targeted Pulse behavior.
