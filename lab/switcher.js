/* ---------------------------------------------------------------------------
   lab chrome — NOT part of any candidate design.

   This is the harness that lets you hop between variants. It deliberately does
   not match the site's visual language: monospace, a hazard stripe, and a green
   that appears nowhere in the palette, so at a glance it can never be mistaken
   for part of the thing being evaluated.

   When a winner is picked, delete this file and the one <script> tag that loads
   it. Nothing in any candidate depends on it.
--------------------------------------------------------------------------- */
(function () {
   const VARIANTS = [
      { key: "a", file: "a-bezel.html", name: "bezel" },
      { key: "b", file: "b-zoom.html", name: "deep zoom" },
      { key: "c", file: "c-deck.html", name: "deck" },
      { key: "d", file: "d-splitflap.html", name: "split-flap" },
      { key: "e", file: "e-aperture.html", name: "aperture" },
   ];

   const here = location.pathname.split("/").pop();
   const STORE = "lab-switcher-hidden";

   const css = `
   .labsw, .labsw-peek {
      position: fixed; right: 16px; top: 50%; transform: translateY(-50%);
      z-index: 99999;
      font-family: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace;
      -webkit-font-smoothing: antialiased;
   }
   .labsw {
      width: 178px;
      background: rgba(18, 19, 21, 0.9);
      -webkit-backdrop-filter: blur(12px) saturate(1.3);
      backdrop-filter: blur(12px) saturate(1.3);
      border: 1px solid rgba(255, 255, 255, 0.17);
      border-radius: 9px;
      overflow: hidden;
      box-shadow: 0 18px 50px rgba(0, 0, 0, 0.6);
      color: #e8e8ea;
   }
   /* hazard stripe: the fastest possible signal that this is scaffolding */
   .labsw-stripe {
      height: 5px;
      background: repeating-linear-gradient(
         -45deg, #7fe0a8 0 6px, rgba(18,19,21,0.9) 6px 12px);
      opacity: 0.85;
   }
   .labsw-head {
      padding: 9px 11px 8px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.11);
   }
   .labsw-title {
      font-size: 9.5px; font-weight: 700; letter-spacing: 0.17em;
      text-transform: uppercase; color: #7fe0a8;
   }
   .labsw-sub {
      font-size: 9px; letter-spacing: 0.11em; text-transform: uppercase;
      color: #85858d; margin-top: 3px;
   }
   .labsw-list { padding: 5px; display: grid; gap: 1px; }
   .labsw-item {
      display: grid; grid-template-columns: 15px 1fr; align-items: center; gap: 7px;
      padding: 6px 7px; border-radius: 4px;
      font-size: 11px; letter-spacing: 0.03em;
      color: #a6a6ad; text-decoration: none;
      border: 1px solid transparent;
      transition: background 0.14s, color 0.14s;
   }
   .labsw-item:hover { background: rgba(255, 255, 255, 0.07); color: #f2f2f4; }
   .labsw-item b { font-weight: 700; color: #6f6f78; font-size: 10px; }
   .labsw-item:hover b { color: #a6a6ad; }
   .labsw-item[aria-current="page"] {
      background: rgba(127, 224, 168, 0.13);
      border-color: rgba(127, 224, 168, 0.34);
      color: #bff3d6;
   }
   .labsw-item[aria-current="page"] b { color: #7fe0a8; }
   .labsw-foot {
      border-top: 1px solid rgba(255, 255, 255, 0.11);
      padding: 5px; display: grid; gap: 1px;
   }
   .labsw-foot a, .labsw-foot button {
      display: grid; grid-template-columns: 15px 1fr; align-items: center; gap: 7px;
      padding: 6px 7px; border-radius: 4px;
      font: inherit; font-size: 10.5px; letter-spacing: 0.03em;
      color: #85858d; text-decoration: none; text-align: left;
      background: none; border: 0; cursor: pointer; width: 100%;
      transition: background 0.14s, color 0.14s;
   }
   .labsw-foot a:hover, .labsw-foot button:hover {
      background: rgba(255, 255, 255, 0.07); color: #e8e8ea;
   }
   .labsw-foot b { font-weight: 700; color: #6f6f78; font-size: 10px; }

   /* collapsed: a tab you can still see and click, never fully gone */
   .labsw-peek {
      display: none;
      padding: 9px 7px;
      background: rgba(18, 19, 21, 0.9);
      -webkit-backdrop-filter: blur(12px);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.17);
      border-right: 0;
      border-radius: 7px 0 0 7px;
      right: 0;
      cursor: pointer;
      writing-mode: vertical-rl;
      font-size: 9.5px; font-weight: 700; letter-spacing: 0.17em;
      text-transform: uppercase; color: #7fe0a8;
   }
   .labsw-peek:hover { background: rgba(28, 30, 33, 0.95); }
   body[data-labsw-hidden] .labsw { display: none; }
   body[data-labsw-hidden] .labsw-peek { display: block; }

   @media (max-width: 720px) {
      .labsw { width: 150px; right: 8px; }
   }
   `;

   const style = document.createElement("style");
   style.textContent = css;
   document.head.append(style);

   const panel = document.createElement("aside");
   panel.className = "labsw";
   panel.setAttribute("aria-label", "navigation prototype switcher");
   panel.innerHTML =
      '<div class="labsw-stripe"></div>' +
      '<div class="labsw-head">' +
      '<div class="labsw-title">navigation lab</div>' +
      '<div class="labsw-sub">prototype · not final</div>' +
      "</div>" +
      '<nav class="labsw-list">' +
      VARIANTS.map(
         (v) =>
            `<a class="labsw-item" href="${v.file}" data-key="${v.key}"${
               v.file === here ? ' aria-current="page"' : ""
            }><b>${v.key.toUpperCase()}</b><span>${v.name}</span></a>`
      ).join("") +
      "</nav>" +
      '<div class="labsw-foot">' +
      '<a href="index.html"><b>&larr;</b><span>all variants</span></a>' +
      '<button type="button" id="labsw-hide"><b>H</b><span>hide panel</span></button>' +
      "</div>";

   const peek = document.createElement("button");
   peek.type = "button";
   peek.className = "labsw-peek";
   peek.textContent = "lab";
   peek.setAttribute("aria-label", "show navigation prototype switcher");

   document.body.append(panel, peek);

   /* carrying the hash across means switching variants keeps you on the same
      section — which is the entire point of being able to flip between them */
   panel.querySelectorAll(".labsw-item").forEach((a) => {
      a.addEventListener("click", (e) => {
         if (a.getAttribute("aria-current") === "page") { e.preventDefault(); return; }
         e.preventDefault();
         location.href = a.getAttribute("href") + (location.hash || "");
      });
   });

   function setHidden(on) {
      document.body.toggleAttribute("data-labsw-hidden", on);
      try { on ? localStorage.setItem(STORE, "1") : localStorage.removeItem(STORE); } catch (_) {}
   }
   try { if (localStorage.getItem(STORE)) setHidden(true); } catch (_) {}

   document.getElementById("labsw-hide").addEventListener("click", () => setHidden(true));
   peek.addEventListener("click", () => setHidden(false));

   /* a–e jump between variants, h toggles the panel. every candidate binds
      digits, arrows and j/k, so these letters are deliberately clear of them */
   addEventListener("keydown", (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const k = e.key.toLowerCase();
      if (k === "h") { e.preventDefault(); setHidden(!document.body.hasAttribute("data-labsw-hidden")); return; }
      const hit = VARIANTS.find((v) => v.key === k);
      if (hit && hit.file !== here) { e.preventDefault(); location.href = hit.file + (location.hash || ""); }
   });
})();
