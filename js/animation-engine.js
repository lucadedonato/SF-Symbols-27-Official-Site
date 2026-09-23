(() => {
  "use strict";

  const DATA = window.SF_OFFICIAL_ANIMATION_DATA;

  if (!DATA) {
    throw new Error("SF_OFFICIAL_ANIMATION_DATA ausente.");
  }

  const running = new Set();
  let fullData = null;

  function setFullData(data) {
    if (!data || !data.symbols || Number(data.catalogCount) !== 7936) return false;
    fullData = data;
    return true;
  }

  function symbolMetadata(symbolName) {
    return fullData?.symbols?.[symbolName] || null;
  }

  function curve(name) {
    const value = DATA.curves?.[name];
    if (!Array.isArray(value) || value.length !== 4) {
      return "linear";
    }
    return `cubic-bezier(${value.join(",")})`;
  }

  function previewElements() {
    return {
      preview: document.getElementById("modalPreview"),
      image: document.getElementById("modalImage"),
      layered: document.getElementById("modalLayered"),
      svg: document.querySelector("#modalLayered svg")
    };
  }

  function clearVisualState() {
    const { preview, image, svg } = previewElements();

    if (image) {
      image.style.transform = "";
      image.style.opacity = "";
    }

    if (svg) {
      for (const element of svg.querySelectorAll("[data-layer], [data-static]")) {
        element.style.transform = "";
        element.style.opacity = "";
      }
    }

    preview?.classList.remove("layered-active");
  }

  function stop() {
    for (const animation of running) {
      try { animation.cancel(); } catch (_) {}
    }
    running.clear();

    const { image, svg } = previewElements();
    image?.getAnimations?.().forEach(animation => animation.cancel());
    svg?.getAnimations?.({ subtree: true }).forEach(animation => animation.cancel());

    clearVisualState();
    return true;
  }

  function remember(animation) {
    running.add(animation);

    const remove = () => running.delete(animation);
    animation.addEventListener("finish", remove, { once: true });
    animation.addEventListener("cancel", remove, { once: true });

    return animation;
  }

  function wholeImage() {
    const { preview, image } = previewElements();
    preview?.classList.remove("layered-active");
    return image;
  }

  function animate(element, frames, options) {
    if (!element) {
      return false;
    }

    remember(element.animate(frames, options));
    return true;
  }

  function bounce(direction) {
    const recipe = DATA.recipes.bounce;
    const sequence = recipe?.[direction];
    const image = wholeImage();

    if (!image || !Array.isArray(sequence) || sequence.length !== 3) {
      return false;
    }

    stop();

    const totalSeconds = Number(recipe.total_duration_s);
    if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
      return false;
    }

    let elapsed = 0;
    const frames = [{
      transform: "scale(1)",
      offset: 0,
      easing: curve(sequence[0].curve)
    }];

    for (let index = 0; index < sequence.length; index += 1) {
      const step = sequence[index];
      elapsed += Number(step.duration_s || 0);

      const frame = {
        transform: `scale(${Number(step.toScale)})`,
        offset: Math.min(elapsed / totalSeconds, 1)
      };

      if (index + 1 < sequence.length) {
        frame.easing = curve(sequence[index + 1].curve);
      }

      frames.push(frame);
    }

    return animate(image, frames, {
      duration: totalSeconds * 1000,
      iterations: 1,
      fill: "none"
    });
  }

  function pulseTargets(symbolName) {
    const { preview, svg } = previewElements();
    const metadataPaths = symbolMetadata(symbolName)?.effects?.pulse?.annotatedLayerTargets;
    const paths = Array.isArray(metadataPaths) && metadataPaths.length
      ? metadataPaths
      : DATA.pulseTargets?.[symbolName];

    if (!svg || !Array.isArray(paths) || paths.length === 0) {
      return null;
    }

    const targets = [];

    for (const path of paths) {
      const escaped = CSS.escape(String(path));
      const element = svg.querySelector(`[data-layer="${escaped}"]`);
      if (element && !targets.includes(element)) {
        targets.push(element);
      }
    }

    if (targets.length === 0) {
      return null;
    }

    preview?.classList.add("layered-active");
    return targets;
  }

  function pulse(symbolName) {
    const recipe = DATA.recipes.pulse;
    const sequence = recipe?.opacity_sequence;

    if (!Array.isArray(sequence) || sequence.length !== 2) {
      return false;
    }

    stop();

    const targets = pulseTargets(symbolName) || [wholeImage()].filter(Boolean);
    if (targets.length === 0) {
      return false;
    }

    const totalSeconds = Number(recipe.duration_default_s);
    const firstSeconds = Number(sequence[0].duration_s);
    const firstOffset = firstSeconds / totalSeconds;

    const frames = [
      { opacity: 1, offset: 0, easing: curve(sequence[0].curve) },
      { opacity: Number(sequence[0].toOpacity), offset: firstOffset, easing: curve(sequence[1].curve) },
      { opacity: Number(sequence[1].toOpacity), offset: 1 }
    ];

    for (const target of targets) {
      animate(target, frames, {
        duration: totalSeconds * 1000,
        iterations: Number(recipe.repeatCount_default || 1),
        fill: "none"
      });
    }

    return true;
  }

  function breathe(withPulse) {
    const recipe = DATA.recipes.breathe;
    const image = wholeImage();

    if (!image || !recipe) {
      return false;
    }

    stop();

    const totalSeconds = Number(recipe.cycle_duration_s);
    const scale = Number(recipe.breatheScale);
    const half = totalSeconds / 2;

    const scaleFrames = [
      { transform: "scale(1)", offset: 0, easing: curve("breathe.scaleCurve") },
      { transform: `scale(${scale})`, offset: half / totalSeconds, easing: curve("breathe.scaleCurve") },
      { transform: "scale(1)", offset: 1 }
    ];

    animate(image, scaleFrames, {
      duration: totalSeconds * 1000,
      iterations: 1,
      fill: "none"
    });

    if (withPulse) {
      const opacity = recipe.pulse_variant_opacity_sequence;
      if (Array.isArray(opacity) && opacity.length === 2) {
        animate(image, [
          { opacity: 1, offset: 0, easing: curve(opacity[0].curve) },
          { opacity: Number(opacity[0].toOpacity), offset: .5, easing: curve(opacity[1].curve) },
          { opacity: Number(opacity[1].toOpacity), offset: 1 }
        ], {
          duration: totalSeconds * 1000,
          iterations: 1,
          fill: "none"
        });
      }
    }

    return true;
  }

  function wiggleRotation(symbolName) {
    const metadataDirection = symbolMetadata(symbolName)?.effects?.wiggle?.preferredDirection
      || symbolMetadata(symbolName)?.preferences?.wiggleDirection;
    const direction = metadataDirection || DATA.wiggleRotationDirection?.[symbolName];
    const recipe = DATA.recipes.wiggleRotation;
    const image = wholeImage();

    if (!image || !direction || !recipe) {
      return false;
    }

    stop();

    const targets = recipe.targets_degrees;
    const durations = recipe.durations_s;
    const curveNames = recipe.curves;

    if (!Array.isArray(targets) || !Array.isArray(durations) || targets.length !== durations.length) {
      return false;
    }

    const normalizedDirection = String(direction).toLowerCase();
    const sign = normalizedDirection === "counterclockwise" ? -1 : 1;
    const total = durations.reduce((sum, value) => sum + Number(value), 0);
    let elapsed = 0;

    const frames = [{
      transform: "rotate(0deg)",
      offset: 0,
      easing: curve(curveNames?.[0])
    }];

    for (let index = 0; index < targets.length; index += 1) {
      elapsed += Number(durations[index]);

      const frame = {
        transform: `rotate(${Number(targets[index]) * sign}deg)`,
        offset: Math.min(elapsed / total, 1)
      };

      if (index + 1 < targets.length) {
        frame.easing = curve(curveNames?.[index + 1]);
      }

      frames.push(frame);
    }

    return animate(image, frames, {
      duration: total * 1000,
      iterations: 1,
      fill: "none"
    });
  }

  function availableEffects(symbolName, hasSvg) {
    if (!hasSvg) {
      return [];
    }

    const effects = [
      { id: "bounce-up", label: "Bounce Up" },
      { id: "bounce-down", label: "Bounce Down" },
      { id: "pulse", label: "Pulse" },
      { id: "breathe", label: "Breathe" },
      { id: "breathe-pulse", label: "Breathe + Pulse" }
    ];

    const wiggleDirection = symbolMetadata(symbolName)?.effects?.wiggle?.preferredDirection
      || symbolMetadata(symbolName)?.preferences?.wiggleDirection
      || DATA.wiggleRotationDirection?.[symbolName];
    const normalizedWiggle = String(wiggleDirection || "").toLowerCase();
    if (normalizedWiggle === "clockwise" || normalizedWiggle === "counterclockwise") {
      effects.splice(3, 0, { id: "wiggle", label: "Wiggle" });
    }

    return effects;
  }

  function play(effectId, symbolName) {
    switch (effectId) {
      case "bounce-up": return bounce("up");
      case "bounce-down": return bounce("down");
      case "pulse": return pulse(symbolName);
      case "breathe": return breathe(false);
      case "breathe-pulse": return breathe(true);
      case "wiggle": return wiggleRotation(symbolName);
      default: return false;
    }
  }

  window.SFOfficialAnimationEngine = {
    data: DATA,
    setFullData,
    symbolMetadata,
    availableEffects,
    play,
    stop
  };
})();
