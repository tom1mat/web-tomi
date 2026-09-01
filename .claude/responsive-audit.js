const { chromium } = require("playwright");

const VIEWPORTS = [
   { name: "iphone-se", w: 375, h: 667 },
   { name: "iphone-14", w: 390, h: 844 },
   { name: "iphone-plus", w: 430, h: 932 },
   { name: "tablet", w: 768, h: 1024 },
   { name: "laptop-sm", w: 1024, h: 768 },
   { name: "laptop", w: 1280, h: 800 },
   { name: "desktop", w: 1440, h: 900 },
   { name: "wide", w: 1920, h: 1080 },
];

const PAGES = process.argv[2] ? [process.argv[2]] : ["v2.html", "index.html"];
const SHOT_DIR = process.argv[3] || null;

/* Runs inside the page: what is the content column, and what escapes it? */
const probe = () => {
   const doc = document.documentElement;
   const vw = window.innerWidth;

   // the shared content column every section lives in
   const sec = document.querySelector("section");
   const cs = getComputedStyle(sec);
   const r = sec.getBoundingClientRect();
   const padL = parseFloat(cs.paddingLeft);
   const padR = parseFloat(cs.paddingRight);
   const colLeft = r.left + padL;
   const colRight = r.right - padR;

   const overflowsViewport = [];
   const escapesColumn = [];

   for (const el of document.querySelectorAll("body *")) {
      const b = el.getBoundingClientRect();
      if (b.width === 0 || b.height === 0) continue;
      const cls = (el.className && el.className.baseVal !== undefined
         ? el.className.baseVal
         : String(el.className || "")
      )
         .split(" ")
         .filter(Boolean)
         .slice(0, 2)
         .join(".");
      const id = el.tagName.toLowerCase() + (cls ? "." + cls : "");
      const pos = getComputedStyle(el).position;
      if (pos === "fixed") continue; // rails/shader are meant to hug the edges

      if (b.right > vw + 1) overflowsViewport.push(`${id}@${Math.round(b.right)}`);
      // only flag leaf-ish content, not the section wrappers themselves
      if (b.right > colRight + 1 && !el.matches("section, body > div"))
         escapesColumn.push(`${id}@${Math.round(b.right)}`);
   }

   const logos = [...document.querySelectorAll(".logos img")].map((i) => {
      const b = i.getBoundingClientRect();
      return {
         name: i.alt,
         w: Math.round(b.width),
         right: Math.round(b.right),
         top: Math.round(b.top),
      };
   });

   const h1 = document.querySelector("h1");
   const h1r = h1 ? h1.getBoundingClientRect() : null;

   return {
      vw,
      docScrollW: doc.scrollWidth,
      hScroll: doc.scrollWidth > vw,
      col: { left: Math.round(colLeft), right: Math.round(colRight), w: Math.round(colRight - colLeft) },
      h1Right: h1r ? Math.round(h1r.right) : null,
      logos,
      logoRowRight: logos.length ? Math.max(...logos.map((l) => l.right)) : null,
      logoRows: logos.length ? new Set(logos.map((l) => l.top)).size : null,
      overflowsViewport: [...new Set(overflowsViewport)].slice(0, 6),
      escapesColumn: [...new Set(escapesColumn)].slice(0, 6),
   };
};

(async () => {
   const browser = await chromium.launch();
   const results = [];

   for (const page of PAGES) {
      for (const vp of VIEWPORTS) {
         const ctx = await browser.newContext({
            viewport: { width: vp.w, height: vp.h },
            deviceScaleFactor: 1,
            reducedMotion: "reduce", // keep reveals from hiding content
         });
         const p = await ctx.newPage();
         const errs = [];
         p.on("pageerror", (e) => errs.push(e.message));
         await p.goto(`http://localhost:8000/${page}`, { waitUntil: "networkidle" });
         await p.waitForTimeout(400);
         const data = await p.evaluate(probe);
         data.page = page;
         data.vp = `${vp.name} ${vp.w}`;
         data.jsErrors = errs;
         results.push(data);

         if (SHOT_DIR) {
            await p.screenshot({
               path: `${SHOT_DIR}/${page.replace(".html", "")}-${vp.w}.png`,
               fullPage: true,
            });
         }
         await ctx.close();
      }
   }

   await browser.close();

   for (const r of results) {
      const flags = [];
      if (r.hScroll) flags.push(`H-SCROLL(doc=${r.docScrollW})`);
      if (r.overflowsViewport.length) flags.push(`OFF-SCREEN[${r.overflowsViewport.join(",")}]`);
      if (r.escapesColumn.length) flags.push(`ESCAPES-COL[${r.escapesColumn.join(",")}]`);
      if (r.jsErrors.length) flags.push(`JS-ERR[${r.jsErrors.join("|")}]`);
      console.log(
         `${r.page.padEnd(11)} ${r.vp.padEnd(16)} col=${r.col.left}-${r.col.right}(${r.col.w}) ` +
            `h1R=${r.h1Right} logoR=${r.logoRowRight} rows=${r.logoRows} ` +
            (flags.length ? "❌ " + flags.join(" ") : "✅ ok")
      );
   }
})();
