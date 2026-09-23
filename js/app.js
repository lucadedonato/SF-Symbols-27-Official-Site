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
  const frameFolder = document.getElementById("frameFolder");
  const capturedFrame = document.getElementById("capturedFrame");
  const captureStatus = document.getElementById("captureStatus");
  let captureDownload = null;
  const captures = new Map();
  const bundledCaptureRoot = "assets/captures/bounce/";
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
      if (category && !(symbol.categories || []).includes(category)) {
        return false;
      }

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

    counter.textContent = `${filtered.length.toLocaleString("pt-BR")} símbolos`;
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
    let names = ["folder"];
    try {
      const response = await fetch(bundledCaptureRoot + "index.json");
      if (response.ok) {
        const catalog = await response.json();
        if (Array.isArray(catalog.symbols)) {
          names = [...new Set([...catalog.symbols, "folder"])];
        }
      }
    } catch (_) { /* Optional capture index not installed. */ }

    for (const name of names) {
      if (!symbols.some(symbol => symbol.name === name)) continue;
      const root = bundledCaptureRoot + encodeURIComponent(name) + "/";
      const legacyRoot = name === "folder" ? bundledCaptureRoot : null;
      for (const directory of [root, legacyRoot].filter(Boolean)) {
        try {
          const response = await fetch(directory + "manifest.json");
          if (!response.ok) continue;
          const manifest = await response.json();
          if (manifest.source !== "Apple Symbols.framework" || manifest.symbol !== name ||
              manifest.effect !== "bounce" || !Number.isInteger(manifest.frames) ||
              manifest.frames < 6 || manifest.uniquePixelFrames < 6 ||
              !(Number(manifest.fps) > 0 && Number(manifest.fps) <= 120)) continue;
          const frames = Array.from({ length: manifest.frames }, (_, index) =>
            directory + "frame-" + String(index).padStart(4, "0") + ".png");
          const [first, last] = await Promise.all([
            fetch(frames[0], { method: "HEAD" }),
            fetch(frames[frames.length - 1], { method: "HEAD" })
          ]);
          if (!first.ok || !last.ok) continue;
          captures.set(name, {
            effect: manifest.effect,
            fps: Number(manifest.fps),
            frames,
            bundled: true,
            download: bundledCaptureRoot + "downloads/" + encodeURIComponent(name) + "-bounce.zip"
          });
          if (currentSymbol?.name === name) refreshCaptureControls();
          break;
        } catch (_) { /* The optional capture is not installed. */ }
      }
    }
  }


  function refreshCaptureControls() {
    if (!currentSymbol) return;
    const capture = captures.get(currentSymbol.name);
    const previous = animationButtons.querySelector("[data-captured]");
    animationButtons.querySelector("[data-capture-download]")?.remove();
    previous?.remove();
    if (!capture) {
      captureStatus.textContent = "";
      return;
    }
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.captured = "true";
    button.textContent = "▶ Captura Apple: " + capture.effect;
    button.addEventListener("click", () => playCaptured(capture));
    animationButtons.prepend(button);
    if (capture.download) {
      const download = document.createElement("a");
      download.dataset.captureDownload = "true";
      download.className = "capture-download";
      download.href = capture.download;
      download.download = currentSymbol.name + "-bounce.zip";
      download.textContent = "Baixar animação oficial (.zip)";
      animationButtons.appendChild(download);
    }
    animationSection.hidden = false;
    captureStatus.textContent = capture.frames.length + " frames do runtime Apple importados";
  }

  async function importCapturedFolder(files) {
    const selected = Array.from(files);
    const manifestFile = selected.find(file => file.name === "manifest.json");
    if (!manifestFile) {
      captureStatus.textContent = "Selecione a pasta que contém manifest.json e os frames PNG.";
      return;
    }
    let manifest;
    try {
      manifest = JSON.parse(await manifestFile.text());
    } catch (_) {
      captureStatus.textContent = "Manifest inválido.";
      return;
    }
    const symbol = symbols.find(item => item.name === manifest.symbol);
    const pngFiles = selected.filter(file => /^frame-\d+\.png$/i.test(file.name))
      .sort((a, b) => a.name.localeCompare(b.name));
    if (!symbol || manifest.source !== "Apple Symbols.framework" ||
        !Number.isInteger(manifest.frames) || pngFiles.length !== manifest.frames ||
        !(manifest.uniquePixelFrames >= 6) ||
        !(Number(manifest.fps) > 0 && Number(manifest.fps) <= 120)) {
      captureStatus.textContent = "Captura incompatível ou não validada. Nenhuma animação importada.";
      return;
    }
    const old = captures.get(symbol.name);
    if (old && !old.bundled) old.frames.forEach(url => URL.revokeObjectURL(url));
    const frames = pngFiles.map(file => URL.createObjectURL(file));
    captures.set(symbol.name, { effect: String(manifest.effect), fps: Number(manifest.fps), frames });
    if (currentSymbol?.name === symbol.name) refreshCaptureControls();
    captureStatus.textContent = "Captura importada: " + symbol.name + " / " + manifest.effect;
  }

  function renderAnimationButtons(symbol) {
    animationButtons.replaceChildren();

    const effects = ENGINE.availableEffects(symbol.name, Boolean(symbol.svg));
    animationSection.hidden = effects.length === 0;

    for (const effect of effects) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.effect = effect.id;
      button.textContent = effect.label;
      button.addEventListener("click", () => {
        stopCapturedPlayback();
        ENGINE.play(effect.id, symbol.name);
      });
      animationButtons.appendChild(button);
    }
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

    renderAnimationButtons(symbol);
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
  frameFolder.addEventListener("change", () => importCapturedFolder(frameFolder.files));

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
