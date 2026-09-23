(() => {
  "use strict";

  const DATA = window.SF_CATALOG;
  const ENGINE = window.SFOfficialAnimationEngine;

  if (!DATA || !ENGINE) {
    throw new Error("Dados do SF Symbols 27 não foram carregados.");
  }

  const symbols = DATA.symbols;
  const PAGE_SIZE = 180;

  const searchInput = document.getElementById("search");
  const categorySelect = document.getElementById("category");
  const grid = document.getElementById("grid");
  const counter = document.getElementById("counter");
  const loadMoreButton = document.getElementById("loadMore");
  const modal = document.getElementById("modal");
  const modalPreview = document.getElementById("modalPreview");
  const modalImage = document.getElementById("modalImage");
  const modalLayered = document.getElementById("modalLayered");
  const missingPreview = document.getElementById("missingPreview");
  const modalName = document.getElementById("modalName");
  const modalMeta = document.getElementById("modalMeta");
  const modalCategories = document.getElementById("modalCategories");
  const animationSection = document.getElementById("animationSection");
  const animationButtons = document.getElementById("animationButtons");
  const stopAnimationButton = document.getElementById("stopAnimation");
  const downloadButton = document.getElementById("downloadButton");
  const capturedFrame = document.getElementById("capturedFrame");
  const captureStatus = document.getElementById("captureStatus");
  const animationDownloadGroup = document.getElementById("animationDownloadGroup");
  const animationDownloadSelect = document.getElementById("animationDownloadSelect");
  const downloadAnimationButton = document.getElementById("downloadAnimationButton");
  const captures = new Map();
  const bundledCaptureRoot = "assets/captures/";
  const capturedEffects = ["bounce", "pulse", "breathe", "wiggle", "rotate", "drawOn", "drawOff"];
  let captureTimer = null;
  let captureUrls = [];
  let captureIndex = 0;

  let filtered = symbols;
  let visibleCount = PAGE_SIZE;
  let currentSymbol = null;
  let layerLoadToken = 0;

  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function searchableText(symbol) {
    return normalize([
      symbol.name,
      ...(symbol.aliases || []),
      ...(symbol.searchTerms || []),
      ...(symbol.categories || [])
    ].join(" "));
  }

  function populateCategories() {
    const fragment = document.createDocumentFragment();

    for (const category of DATA.categories) {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      fragment.appendChild(option);
    }

    categorySelect.appendChild(fragment);
  }

  function applyFilters() {
    const query = normalize(searchInput.value.trim());
    const category = categorySelect.value;

    filtered = symbols.filter(symbol => {
      if (category && !(symbol.categories || []).includes(category)) return false;
      return !query || searchableText(symbol).includes(query);
    });

    visibleCount = PAGE_SIZE;
    render();
  }

  function buildCard(symbol) {
    const card = document.createElement("article");
    card.className = "symbol-card";
    card.tabIndex = 0;
    card.title = symbol.name;

    const preview = document.createElement("div");
    preview.className = "symbol-preview";

    if (symbol.svg) {
      const image = document.createElement("img");
      image.loading = "lazy";
      image.src = symbol.svg;
      image.alt = symbol.name;
      preview.appendChild(image);
    } else {
      preview.classList.add("missing");
      preview.textContent = "SVG oficial não recuperado";
    }

    const name = document.createElement("div");
    name.className = "symbol-name";
    name.textContent = symbol.name;

    card.append(preview, name);

    if (!symbol.svg) {
      const badge = document.createElement("div");
      badge.className = "symbol-badge";
      badge.textContent = "Catálogo oficial • sem SVG extraído";
      card.appendChild(badge);
    }

    const open = () => openSymbol(symbol);
    card.addEventListener("click", open);
    card.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });

    return card;
  }

  function render() {
    grid.replaceChildren();
    const fragment = document.createDocumentFragment();

    for (const symbol of filtered.slice(0, visibleCount)) {
      fragment.appendChild(buildCard(symbol));
    }

    grid.appendChild(fragment);

    const total = Number(DATA.summary?.catalog || symbols.length);
    const officialSvg = Number(DATA.summary?.officialSvg || symbols.filter(item => item.svg).length);
    counter.textContent = filtered.length === total
      ? total.toLocaleString("pt-BR") + " símbolos • " + officialSvg.toLocaleString("pt-BR") + " SVGs oficiais"
      : filtered.length.toLocaleString("pt-BR") + " de " + total.toLocaleString("pt-BR") + " símbolos";
    loadMoreButton.hidden = visibleCount >= filtered.length;
  }

  async function loadLayeredSvg(symbol) {
    const token = ++layerLoadToken;
    modalLayered.replaceChildren();
    modalLayered.hidden = true;
    modalPreview.classList.remove("layered-active");

    if (!symbol.svg || !symbol.hasLayeredSvg) {
      return;
    }

    try {
      const response = await fetch(`assets/layered/${symbol.name}.svg`);
      if (!response.ok) {
        return;
      }

      const source = await response.text();
      if (token !== layerLoadToken || currentSymbol?.name !== symbol.name) {
        return;
      }

      const parsed = new DOMParser().parseFromString(source, "image/svg+xml");
      if (parsed.querySelector("parsererror")) {
        return;
      }

      const svg = parsed.documentElement;
      if (svg.namespaceURI !== "http://www.w3.org/2000/svg") {
        return;
      }

      svg.style.width = "100%";
      svg.style.height = "100%";
      modalLayered.replaceChildren(document.importNode(svg, true));
      modalLayered.hidden = false;
      modalLayered.setAttribute("aria-hidden", "false");
    } catch (_) {
      modalLayered.replaceChildren();
      modalLayered.hidden = true;
    }
  }


  function stopCapturedPlayback() {
    if (captureTimer !== null) clearInterval(captureTimer);
    captureTimer = null;
    capturedFrame.hidden = true;
    capturedFrame.removeAttribute("src");
    modalPreview.classList.remove("captured-active");
  }

  function playCaptured(capture) {
    ENGINE.stop();
    stopCapturedPlayback();
    if (!capture || capture.frames.length === 0) return;
    modalPreview.classList.add("captured-active");
    capturedFrame.hidden = false;
    captureIndex = 0;
    const tick = () => {
      capturedFrame.src = capture.frames[captureIndex];
      captureIndex = (captureIndex + 1) % capture.frames.length;
    };
    tick();
    captureTimer = setInterval(tick, 1000 / capture.fps);
  }

  async function loadBundledCaptures() {
    for (const effect of capturedEffects) {
      const effectRoot = bundledCaptureRoot + effect + "/";
      let names = [];
      try {
        const response = await fetch(effectRoot + "index.json");
        if (!response.ok) continue;
        const catalog = await response.json();
        if (Array.isArray(catalog.symbols)) names = catalog.symbols;
      } catch (_) { continue; }

      for (const name of names) {
        if (!symbols.some(symbol => symbol.name === name)) continue;
        const directory = effectRoot + encodeURIComponent(name) + "/";
        try {
          const response = await fetch(directory + "manifest.json");
          if (!response.ok) continue;
          const manifest = await response.json();
          if (manifest.source !== "Apple Symbols.framework" || manifest.symbol !== name ||
              manifest.effect !== effect || !Number.isInteger(manifest.frames) ||
              manifest.frames < 6 || manifest.uniquePixelFrames < 6 ||
              !(Number(manifest.fps) > 0 && Number(manifest.fps) <= 120)) continue;
          const frames = Array.from({ length: manifest.frames }, (_, index) =>
            directory + "frame-" + String(index).padStart(4, "0") + ".png");
          const key = name + "::" + effect;
          captures.set(key, {
            effect, fps: Number(manifest.fps), frames, bundled: true,
            download: effectRoot + "downloads/" + encodeURIComponent(name) + "-" + effect + ".zip"
          });
        } catch (_) { /* Capture absent or invalid. */ }
      }
    }
    if (currentSymbol) refreshCaptureControls();
  }

  function renderAnimationButtons(symbol) {
    animationButtons.replaceChildren();
    const effects = ENGINE.availableEffects(symbol.name, Boolean(symbol.svg));

    for (const effect of effects) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "▶ " + effect.label;
      button.addEventListener("click", () => {
        stopCapturedPlayback();
        ENGINE.play(effect.id, symbol.name);
      });
      animationButtons.appendChild(button);
    }

    return effects;
  }

  function refreshCaptureControls() {
    if (!currentSymbol) return;

    const genericEffects = renderAnimationButtons(currentSymbol);
    const capturesForSymbol = capturedEffects
      .map(effect => captures.get(currentSymbol.name + "::" + effect))
      .filter(Boolean);

    const genericRuntimeNames = new Set(["bounce", "pulse", "breathe", "wiggle"]);
    const extraRuntimeCaptures = capturesForSymbol.filter(capture => !genericRuntimeNames.has(capture.effect));

    for (const capture of extraRuntimeCaptures) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "▶ " + capture.effect.replace(/([A-Z])/g, " $1").replace(/^./, value => value.toUpperCase());
      button.addEventListener("click", () => playCaptured(capture));
      animationButtons.appendChild(button);
    }

    animationSection.hidden = genericEffects.length === 0 && extraRuntimeCaptures.length === 0;
    captureStatus.textContent = genericEffects.length
      ? "Efeitos reproduzidos a partir das receitas e metadados recuperados do SF Symbols 27."
      : "";

    animationDownloadSelect.replaceChildren();
    for (const capture of capturesForSymbol) {
      const option = document.createElement("option");
      option.value = capture.effect;
      option.textContent = capture.effect.replace(/([A-Z])/g, " $1").replace(/^./, value => value.toUpperCase());
      animationDownloadSelect.appendChild(option);
    }

    animationDownloadGroup.hidden = capturesForSymbol.length === 0;

    const updateDownload = () => {
      const selected = captures.get(currentSymbol.name + "::" + animationDownloadSelect.value);
      if (!selected?.download) {
        downloadAnimationButton.removeAttribute("href");
        downloadAnimationButton.removeAttribute("download");
        return;
      }
      downloadAnimationButton.href = selected.download;
      downloadAnimationButton.download = currentSymbol.name + "-" + selected.effect + ".zip";
    };

    animationDownloadSelect.onchange = updateDownload;
    updateDownload();
  }

  function openSymbol(symbol) {
    stopCapturedPlayback();
    ENGINE.stop();
    currentSymbol = symbol;

    modalName.textContent = symbol.name;
    modalMeta.textContent = symbol.availability ? `SF Symbols ${symbol.availability}` : "";
    modalCategories.textContent = (symbol.categories || []).join(" • ");

    modalPreview.classList.remove("layered-active");
    modalLayered.hidden = true;
    modalLayered.replaceChildren();

    if (symbol.svg) {
      modalImage.hidden = false;
      missingPreview.hidden = true;
      modalImage.src = symbol.svg;
      modalImage.alt = symbol.name;

      downloadButton.href = symbol.svg;
      downloadButton.setAttribute("download", `${symbol.name}.svg`);
      downloadButton.removeAttribute("aria-disabled");
      downloadButton.textContent = "Baixar SVG oficial";
    } else {
      modalImage.hidden = true;
      modalImage.removeAttribute("src");
      modalImage.alt = "";
      missingPreview.hidden = false;

      downloadButton.removeAttribute("href");
      downloadButton.removeAttribute("download");
      downloadButton.setAttribute("aria-disabled", "true");
      downloadButton.textContent = "SVG oficial não recuperado";
    }

    refreshCaptureControls();
    loadLayeredSvg(symbol);

    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    stopCapturedPlayback();
    ENGINE.stop();
    layerLoadToken += 1;
    currentSymbol = null;
    modalLayered.replaceChildren();
    modalLayered.hidden = true;
    modalPreview.classList.remove("layered-active");
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    modalImage.removeAttribute("src");
  }

  searchInput.addEventListener("input", applyFilters);
  categorySelect.addEventListener("change", applyFilters);
  loadMoreButton.addEventListener("click", () => {
    visibleCount += PAGE_SIZE;
    render();
  });
  stopAnimationButton.addEventListener("click", () => {
    stopCapturedPlayback();
    ENGINE.stop();
  });

  modal.addEventListener("click", event => {
    if (event.target.hasAttribute("data-close")) {
      closeModal();
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && modal.classList.contains("open")) {
      closeModal();
    }
  });

  populateCategories();
  render();
  loadBundledCaptures();
})();
