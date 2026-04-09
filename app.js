(function () {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const config = window.KOOKAT_CONFIG || {};
  const projects = Array.isArray(config.projects) ? config.projects : [];
  const projectGrid = document.getElementById("project-grid");
  const detailList = document.getElementById("project-detail-list");
  const orbitStage = document.querySelector(".orbit-stage");
  const hero = document.querySelector(".hero");
  const starLayers = document.querySelectorAll("[data-star-layer]");
  const meteorLayer = document.querySelector(".meteor-layer");
  const eyeLetters = document.querySelectorAll("[data-eye]");
  const pupils = document.querySelectorAll("[data-pupil]");
  const accentHues = [190, 320, 45, 145, 265];
  const ringOffsets = [
    -Math.PI / 2,
    -Math.PI / 6,
    Math.PI * 0.1,
    Math.PI * 0.42,
    Math.PI * 0.78,
  ];
  let layoutTimeout = 0;
  let animationFrame = 0;
  let activeOrbits = [];

  populateStars(starLayers);
  populateMeteors(meteorLayer);
  installPointerParallax();
  installEyeTracking();
  scheduleProjectLayout();

  window.addEventListener("resize", scheduleProjectLayout, { passive: true });
  window.addEventListener("orientationchange", scheduleProjectLayout, { passive: true });
  window.addEventListener("load", scheduleProjectLayout, { passive: true });

  if (document.fonts && typeof document.fonts.ready?.then === "function") {
    document.fonts.ready.then(scheduleProjectLayout).catch(function () {});
  }

  function scheduleProjectLayout() {
    window.clearTimeout(layoutTimeout);
    layoutTimeout = window.setTimeout(function () {
      renderProjects(projects);
      renderProjectDetails(projects);
    }, 120);
  }

  function renderProjects(entries) {
    if (!projectGrid) return;

    cancelOrbitAnimation();
    projectGrid.textContent = "";

    const system = document.createElement("div");
    const container = orbitStage || projectGrid.parentElement || document.body;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    const cx = width * 0.5;
    const cy = height * 0.5;
    const heroRect = hero
      ? hero.getBoundingClientRect()
      : { width: width * 0.34, height: height * 0.2 };
    const heroHalfW = heroRect.width / 2;
    const heroHalfH = heroRect.height / 2;
    const ringCount = Math.min(5, Math.max(3, Math.ceil(Math.max(entries.length, 1) / 2.5)));
    const ringCounts = new Array(ringCount).fill(0);
    const ringMetrics = buildRingMetrics(width, height, heroHalfW, heroHalfH, ringCount);

    system.className = "orbital-system";
    projectGrid.appendChild(system);

    const core = document.createElement("div");
    core.className = "orbital-core";
    core.style.left = cx.toFixed(2) + "px";
    core.style.top = cy.toFixed(2) + "px";
    system.appendChild(core);

    entries.forEach(function (_, index) {
      ringCounts[index % ringCount] += 1;
    });

    if (!entries.length) {
      const arm = document.createElement("div");
      arm.className = "card-orbit";
      arm.style.transform = "translate(" + (cx + ringMetrics[0].a).toFixed(2) + "px, " + cy.toFixed(2) + "px)";
      arm.appendChild(createPlaceholderNode());
      system.appendChild(arm);
      return;
    }

    const orbits = [];
    const ringCounters = new Array(ringCount).fill(0);

    entries.forEach(function (entry, index) {
      const ringIndex = index % ringCount;
      const ring = ringMetrics[ringIndex];
      const positionInRing = ringCounters[ringIndex];
      const totalInRing = ringCounts[ringIndex];
      const phase = calculateAngle(ringIndex, positionInRing, totalInRing);
      const arm = document.createElement("div");
      const node = createOrbitNode(entry, index);
      const orbit = {
        arm: arm,
        node: node,
        a: ring.a,
        b: ring.b,
        phase: phase,
        period: ring.period,
        direction: ring.direction,
        paused: false,
      };

      ringCounters[ringIndex] += 1;

      arm.className = "card-orbit";
      arm.appendChild(node);
      system.appendChild(arm);
      updateOrbitPosition(orbit, cx, cy);

      node.addEventListener("mouseenter", function () {
        orbit.paused = true;
      });
      node.addEventListener("mouseleave", function () {
        orbit.paused = false;
      });
      node.addEventListener("focus", function () {
        orbit.paused = true;
      });
      node.addEventListener("blur", function () {
        orbit.paused = false;
      });

      orbits.push(orbit);
    });

    activeOrbits = orbits;

    if (!reduceMotion) {
      startOrbitAnimation(cx, cy);
    }
  }

  function buildRingMetrics(width, height, heroHalfW, heroHalfH, ringCount) {
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    const outerA = Math.max(heroHalfW + 250, Math.min(width * 0.48, halfWidth - 54));
    const outerB = Math.max(heroHalfH + 190, Math.min(height * 0.42, halfHeight - 34));
    const innerA = Math.max(heroHalfW + 138, Math.min(width * 0.28, outerA - 128));
    const innerB = Math.max(heroHalfH + 98, Math.min(height * 0.24, outerB - 98));
    const safeOuterA = Math.max(outerA, innerA + 30);
    const safeOuterB = Math.max(outerB, innerB + 24);
    const stepA = ringCount > 1 ? (safeOuterA - innerA) / (ringCount - 1) : 0;
    const stepB = ringCount > 1 ? (safeOuterB - innerB) / (ringCount - 1) : 0;

    return Array.from({ length: ringCount }, function (_, ringIndex) {
      const radiusFactor = ringCount <= 1 ? 0 : ringIndex / (ringCount - 1);

      return {
        a: innerA + stepA * ringIndex,
        b: innerB + stepB * ringIndex,
        period: 62 + Math.pow(radiusFactor, 1.7) * 128,
        direction: ringIndex % 2 === 0 ? -1 : 1,
      };
    });
  }

  function calculateAngle(ringIndex, positionInRing, totalInRing) {
    const baseOffset = ringOffsets[ringIndex % ringOffsets.length];
    if (totalInRing <= 1) {
      return baseOffset;
    }

    return baseOffset + (positionInRing / totalInRing) * Math.PI * 2;
  }

  function startOrbitAnimation(cx, cy) {
    let lastTime = performance.now();

    function tick(now) {
      const dt = Math.min((now - lastTime) / 1000, 0.06);
      lastTime = now;

      activeOrbits.forEach(function (orbit) {
        if (!orbit.paused) {
          orbit.phase += orbit.direction * (dt / orbit.period) * Math.PI * 2;
        }

        updateOrbitPosition(orbit, cx, cy);
      });

      animationFrame = window.requestAnimationFrame(tick);
    }

    animationFrame = window.requestAnimationFrame(tick);
  }

  function cancelOrbitAnimation() {
    if (animationFrame) {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    }

    activeOrbits = [];
  }

  function updateOrbitPosition(orbit, cx, cy) {
    const x = cx + orbit.a * Math.cos(orbit.phase);
    const y = cy + orbit.b * Math.sin(orbit.phase);

    orbit.arm.style.transform = "translate(" + x.toFixed(2) + "px, " + y.toFixed(2) + "px)";
  }

  function createOrbitNode(entry, index) {
    const node = document.createElement("a");
    const orb = document.createElement("span");
    const title = document.createElement("h3");
    const name = typeof entry.name === "string" ? entry.name.trim() : "";
    const href = typeof entry.href === "string" ? entry.href.trim() : "#";

    node.className = "orbit-node";
    node.href = href || "#";
    node.style.setProperty("--index", String(index));
    node.style.setProperty("--accent-hue", String(accentHues[index % accentHues.length]));
    node.style.setProperty("--fade-delay", 120 * index + 200 + "ms");

    if (isExternalLink(node.href)) {
      node.rel = "noreferrer";
    }

    orb.className = "orbit-orb";
    title.className = "orbit-node-title";
    title.textContent = name || "未命名";

    node.appendChild(orb);
    node.appendChild(title);
    return node;
  }

  function createPlaceholderNode() {
    const placeholder = document.createElement("article");
    const orb = document.createElement("span");
    const title = document.createElement("h3");

    placeholder.className = "orbit-node";
    placeholder.style.setProperty("--accent-hue", "190");
    placeholder.style.setProperty("--index", "0");
    placeholder.style.setProperty("--fade-delay", "220ms");

    orb.className = "orbit-orb";
    title.className = "orbit-node-title";
    title.textContent = "这里还空着";

    placeholder.appendChild(orb);
    placeholder.appendChild(title);
    return placeholder;
  }

  function renderProjectDetails(entries) {
    if (!detailList) return;

    detailList.textContent = "";

    if (!entries.length) {
      const empty = document.createElement("article");
      empty.className = "detail-item";
      empty.style.setProperty("--accent-hue", "190");
      empty.appendChild(createTextElement("span", "detail-kicker", "NGC · 0000"));
      empty.appendChild(createTextElement("h3", "detail-title", "等你写下第一个名字，它就会慢慢亮起来。"));
      empty.appendChild(createTextElement("p", "detail-description", "写下一个名字，一句话，再留一扇通往那里的门。"));
      detailList.appendChild(empty);
      return;
    }

    entries.forEach(function (entry, index) {
      const item = document.createElement("a");
      const name = typeof entry.name === "string" ? entry.name.trim() : "";
      const description = typeof entry.description === "string" ? entry.description.trim() : "";
      const href = typeof entry.href === "string" ? entry.href.trim() : "#";

      item.className = "detail-item";
      item.href = href || "#";
      item.style.setProperty("--accent-hue", String(accentHues[index % accentHues.length]));

      if (isExternalLink(item.href)) {
        item.rel = "noreferrer";
      }

      item.appendChild(createTextElement("span", "detail-kicker", orbitLabel(index)));
      item.appendChild(createTextElement("h3", "detail-title", name || "未命名"));
      item.appendChild(createTextElement("p", "detail-description", description || ""));
      item.appendChild(createTextElement("span", "detail-link", "朝那处光走去"));
      detailList.appendChild(item);
    });
  }

  function createTextElement(tagName, className, text) {
    const element = document.createElement(tagName);
    element.className = className;
    element.textContent = text;
    return element;
  }

  function orbitLabel(index) {
    return "NGC · " + String(index + 1).padStart(4, "0");
  }

  function populateStars(layers) {
    layers.forEach(function (layer, layerIndex) {
      const fragment = document.createDocumentFragment();
      const count = Number(layer.dataset.starCount || 40);
      const depth = Number(layer.dataset.depth || 0.2);
      layer.style.setProperty("--depth", String(depth));

      for (let i = 0; i < count; i += 1) {
        const star = document.createElement("span");
        const size = layerIndex === 0 ? randomBetween(1, 2.4) : randomBetween(1.2, 3.2);
        const hue = accentHues[(i + layerIndex) % accentHues.length];

        star.className = "star";
        if (Math.random() > 0.72) {
          star.classList.add("star-color");
          star.style.setProperty("--hue", String(hue));
        }

        star.style.left = randomBetween(0, 100).toFixed(2) + "%";
        star.style.top = randomBetween(0, 100).toFixed(2) + "%";
        star.style.width = size.toFixed(2) + "px";
        star.style.height = size.toFixed(2) + "px";
        star.style.opacity = randomBetween(0.22, 0.96).toFixed(2);
        star.style.setProperty("--duration", randomBetween(2.8, 7.2).toFixed(2) + "s");
        star.style.setProperty("--delay", randomBetween(-7, 0).toFixed(2) + "s");
        fragment.appendChild(star);
      }

      layer.appendChild(fragment);
    });
  }

  function populateMeteors(layer) {
    if (!layer || reduceMotion) {
      return;
    }

    const count = 4;
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < count; i += 1) {
      const meteor = document.createElement("span");
      meteor.className = "meteor";
      meteor.style.left = randomBetween(-24, 18).toFixed(2) + "%";
      meteor.style.top = randomBetween(-4, 42).toFixed(2) + "%";
      meteor.style.width = randomBetween(7, 15).toFixed(2) + "rem";
      meteor.style.setProperty("--meteor-hue", String(accentHues[i % accentHues.length]));
      meteor.style.setProperty("--duration", randomBetween(20, 36).toFixed(2) + "s");
      meteor.style.setProperty("--delay", randomBetween(-36, 0).toFixed(2) + "s");
      meteor.style.setProperty("--angle", randomBetween(16, 30).toFixed(2) + "deg");
      meteor.style.setProperty("--travel-x", randomBetween(72, 110).toFixed(2) + "vw");
      meteor.style.setProperty("--travel-y", randomBetween(22, 42).toFixed(2) + "vh");
      fragment.appendChild(meteor);
    }

    layer.appendChild(fragment);
  }

  function installPointerParallax() {
    if (reduceMotion || !finePointer) {
      return;
    }

    window.addEventListener(
      "pointermove",
      function (event) {
        const x = event.clientX;
        const y = event.clientY;
        const xOffset = (x / window.innerWidth - 0.5) * -36;
        const yOffset = (y / window.innerHeight - 0.5) * -26;

        root.style.setProperty("--pointer-x", x + "px");
        root.style.setProperty("--pointer-y", y + "px");
        root.style.setProperty("--shift-x", xOffset.toFixed(2) + "px");
        root.style.setProperty("--shift-y", yOffset.toFixed(2) + "px");
      },
      { passive: true },
    );
  }

  function installEyeTracking() {
    if (!eyeLetters.length || !pupils.length) {
      return;
    }

    if (!finePointer || reduceMotion) {
      resetPupils();
      return;
    }

    window.addEventListener(
      "pointermove",
      function (event) {
        eyeLetters.forEach(function (eye, index) {
          const pupil = pupils[index];
          const rect = eye.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          const dx = event.clientX - centerX;
          const dy = event.clientY - centerY;
          const angle = Math.atan2(dy, dx);
          const distance = Math.min(rect.width * 0.1, Math.hypot(dx, dy) * 0.06);
          const x = Math.cos(angle) * distance;
          const y = Math.sin(angle) * distance;

          pupil.style.transform =
            "translate(calc(-50% + " +
            x.toFixed(2) +
            "px), calc(-50% + " +
            y.toFixed(2) +
            "px))";
        });
      },
      { passive: true },
    );

    window.addEventListener("pointerleave", resetPupils);
  }

  function resetPupils() {
    pupils.forEach(function (pupil) {
      pupil.style.transform = "translate(-50%, -50%)";
    });
  }

  function isExternalLink(href) {
    try {
      const url = new URL(href, window.location.href);
      return url.origin !== window.location.origin;
    } catch (error) {
      return false;
    }
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }
})();
