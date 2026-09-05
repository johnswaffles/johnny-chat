(() => {
  "use strict";
  const world = document.querySelector(".observatory-world");
  if (!world) return;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const layer = document.createElement("div");
  layer.className = "world-lights";
  layer.setAttribute("aria-hidden", "true");
  world.appendChild(layer);

  // Anchors are pixels in the 1536 x 1024 painting, not viewport positions.
  // These star centers were located in the actual artwork to avoid a second starfield.
  const starCenters = [
    [1003,108],[1106,49],[1186,104],[548,262],[547,321],[841,68],
    [939,33],[1088,164],[455,297],[845,427],[724,344],[470,199],
    [645,302],[444,128],[498,335],[825,305],[883,176],[1173,189],
    [489,260],[1141,121],[604,120],[620,38],[499,458],[1011,60],
    [769,34],[796,437],[769,257],[1159,33],[443,49],[753,117]
  ];
  const windowLights = [
    // Observatory windows, followed by lanterns and the distant valley houses.
    [1238,252,19,29,.13],[1250,414,47,77,.10],
    [1362,416,47,94,.14],[1453,419,26,83,.12],
    [1174,473,15,25,.14],[1318,558,20,34,.14],
    [1159,716,18,29,.13],[1348,735,23,38,.14],
    [121,716,43,89,.10],
    [318,752,7,4,.27],[347,744,6,4,.23],[374,768,6,4,.26],
    [483,801,9,5,.23],[599,784,8,5,.25],[665,745,8,5,.26],
    [541,749,6,4,.22],[558,936,7,4,.24]
  ];
  const points = [
    ...starCenters.map(([x,y],i) => ({x,y,width:4+(i%3)*.6,height:4+(i%3)*.6,kind:"world-twinkle",strength:.45+(i%4)*.065})),
    ...windowLights.map(([x,y,width,height,strength]) => ({x,y,width,height,kind:"world-window",strength}))
  ];
  points.forEach((point,i) => {
    const element = document.createElement("i");
    element.className = point.kind;
    element.dataset.artX = String(point.x);
    element.dataset.artY = String(point.y);
    element.style.setProperty("--light-strength", point.strength);
    element.style.animationDuration = `${point.kind === "world-twinkle" ? 4.1+(i%9)*.43 : 4.8+(i%7)*.31}s`;
    element.style.animationDelay = `${-((i*1.731)%8)}s`;
    layer.appendChild(element);
    point.element = element;
  });

  let layoutFrame = 0;
  function layout() {
    layoutFrame = 0;
    const {width,height} = world.getBoundingClientRect();
    const scale = Math.max(width/1536,height/1024);
    // Read the image layer's real CSS crop, including the phone/tablet art direction.
    const position = getComputedStyle(world).backgroundPosition.split(",").at(-1).trim().split(/\s+/);
    const xFraction = parseFloat(position[0])/100;
    const yFraction = parseFloat(position[1])/100;
    const offsetX = (width-1536*scale)*xFraction;
    const offsetY = (height-1024*scale)*yFraction;
    points.forEach(point => {
      const style = point.element.style;
      style.left = `${offsetX+point.x*scale}px`;
      style.top = `${offsetY+point.y*scale}px`;
      style.width = `${point.width*scale}px`;
      style.height = `${point.height*scale}px`;
    });
  }
  function scheduleLayout() {
    if (!layoutFrame) layoutFrame = requestAnimationFrame(layout);
  }
  function syncMotion() {
    layer.hidden = reducedMotion.matches;
    layer.dataset.paused = String(document.hidden);
  }
  new ResizeObserver(scheduleLayout).observe(world);
  window.addEventListener("resize", scheduleLayout);
  window.addEventListener("pageshow", () => { scheduleLayout(); syncMotion(); });
  window.addEventListener("pagehide", () => {
    cancelAnimationFrame(layoutFrame); layoutFrame = 0;
    layer.dataset.paused = "true";
  });
  document.addEventListener("visibilitychange", syncMotion);
  reducedMotion.addEventListener("change", syncMotion);
  layout(); syncMotion();
})();
