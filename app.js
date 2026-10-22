const state = {
  totalFrames: 24,
  currentFrame: 0,
  selectedObjectId: null,
  playing: false,
  layerCounter: 1,
  layers: [{ id: "layer-1", name: "Layer 1", visible: true }],
  objects: [],
  nextObjectId: 1,
  timer: null,
};

const stageEl = document.getElementById("stage");
const timelineEl = document.getElementById("timeline");
const layerListEl = document.getElementById("layer-list");
const selectedLabelEl = document.getElementById("selected-label");
const stageStatusEl = document.getElementById("stage-status");
const playToggleEl = document.getElementById("play-toggle");
const addKeyframeBtn = document.getElementById("add-keyframe");
const addLayerBtn = document.getElementById("add-layer");

const inspector = {
  x: document.getElementById("prop-x"),
  y: document.getElementById("prop-y"),
  width: document.getElementById("prop-width"),
  height: document.getElementById("prop-height"),
  rotation: document.getElementById("prop-rotation"),
  fill: document.getElementById("prop-fill"),
  text: document.getElementById("prop-text"),
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[char]));
}

function getSelectedObject() {
  return state.objects.find((obj) => obj.id === state.selectedObjectId) || null;
}

function getLayerById(layerId) {
  return state.layers.find((layer) => layer.id === layerId) || state.layers[0];
}

function defaultFrameValues(type = "rect") {
  return {
    x: 200 + (state.objects.length % 4) * 80,
    y: 150 + (state.objects.length % 3) * 60,
    width: type === "text" ? 180 : 96,
    height: type === "text" ? 50 : 96,
    rotation: 0,
    fill: ["#ff6b6b", "#ffd93d", "#7c3aed", "#38bdf8", "#34d399"][state.objects.length % 5],
    text: type === "text" ? "Title" : "",
  };
}

function createObject(type = "rect") {
  const id = `obj-${state.nextObjectId++}`;
  const activeLayer = state.layers[0];
  const object = {
    id,
    type,
    layerId: activeLayer.id,
    keyframes: {},
  };

  object.keyframes[0] = defaultFrameValues(type);
  state.objects.push(object);
  state.selectedObjectId = id;
  renderAll();
}

function addNewLayer() {
  const layerName = `Layer ${state.layerCounter++}`;
  const layer = { id: `layer-${Date.now()}`, name: layerName, visible: true };
  state.layers.push(layer);
  renderLayerList();
}

function makeLayerSelected(layerId) {
  const layer = getLayerById(layerId);
  if (!layer) return;
  state.layers.forEach((entry) => {
    if (entry.id === layerId) {
      entry.visible = true;
    }
  });
  renderLayerList();
}

function getFrameStateAt(object, frame) {
  const keys = Object.keys(object.keyframes).map(Number).sort((a, b) => a - b);

  if (!keys.length) {
    return { ...defaultFrameValues(object.type) };
  }

  if (keys.includes(frame)) {
    return { ...object.keyframes[frame] };
  }

  const previous = [...keys].reverse().find((key) => key < frame);
  const next = keys.find((key) => key > frame);

  if (previous === undefined && next === undefined) {
    return { ...object.keyframes[keys[0]] };
  }

  if (previous === undefined) {
    return { ...object.keyframes[next] };
  }

  if (next === undefined) {
    return { ...object.keyframes[previous] };
  }

  const start = object.keyframes[previous];
  const end = object.keyframes[next];
  const t = (frame - previous) / (next - previous);

  return {
    x: lerp(start.x, end.x, t),
    y: lerp(start.y, end.y, t),
    width: lerp(start.width, end.width, t),
    height: lerp(start.height, end.height, t),
    rotation: lerp(start.rotation, end.rotation, t),
    fill: start.fill,
    text: start.text || "",
  };
}

function ensureKeyframeForCurrentFrame(object) {
  if (!object.keyframes[state.currentFrame]) {
    object.keyframes[state.currentFrame] = {
      ...getFrameStateAt(object, state.currentFrame),
    };
  }
}

function updateInspectorFromSelection() {
  const object = getSelectedObject();
  if (!object) {
    inspector.x.value = 0;
    inspector.y.value = 0;
    inspector.width.value = 100;
    inspector.height.value = 100;
    inspector.rotation.value = 0;
    inspector.fill.value = "#ff6b6b";
    inspector.text.value = "";
    selectedLabelEl.textContent = "No layer selected";
    return;
  }

  ensureKeyframeForCurrentFrame(object);
  const values = object.keyframes[state.currentFrame];
  inspector.x.value = Math.round(values.x);
  inspector.y.value = Math.round(values.y);
  inspector.width.value = Math.round(values.width);
  inspector.height.value = Math.round(values.height);
  inspector.rotation.value = Math.round(values.rotation);
  inspector.fill.value = values.fill || "#ff6b6b";
  inspector.text.value = values.text || "";
  selectedLabelEl.textContent = `${getLayerById(object.layerId).name} • ${object.type}`;
}

function syncSelectedObjectFromInspector() {
  const object = getSelectedObject();
  if (!object) return;

  const activeValues = object.keyframes[state.currentFrame] || { ...defaultFrameValues(object.type) };
  object.keyframes[state.currentFrame] = {
    ...activeValues,
    x: Number(inspector.x.value) || 0,
    y: Number(inspector.y.value) || 0,
    width: Number(inspector.width.value) || 0,
    height: Number(inspector.height.value) || 0,
    rotation: Number(inspector.rotation.value) || 0,
    fill: inspector.fill.value,
    text: inspector.text.value,
  };

  renderAll();
}

function renderLayerList() {
  layerListEl.innerHTML = "";
  state.layers.forEach((layer) => {
    const item = document.createElement("li");
    item.className = "layer-item" + (layer.id === getSelectedObject()?.layerId ? " selected" : "");
    item.innerHTML = `
      <span class="layer-name">${escapeHtml(layer.name)}</span>
      <span class="layer-toggle ${layer.visible ? "on" : ""}"></span>
    `;
    item.addEventListener("click", () => makeLayerSelected(layer.id));
    layerListEl.appendChild(item);
  });
}

function renderTimeline() {
  timelineEl.innerHTML = "";

  for (let i = 0; i < state.totalFrames; i += 1) {
    const frameBtn = document.createElement("button");
    frameBtn.type = "button";
    frameBtn.className = "frame" + (i === state.currentFrame ? " active" : "");

    const selectedObject = getSelectedObject();
    if (selectedObject && Object.prototype.hasOwnProperty.call(selectedObject.keyframes, i)) {
      frameBtn.classList.add("keyframe");
    }

    frameBtn.innerHTML = `<span class="frame-label">${i + 1}</span>`;
    frameBtn.addEventListener("click", () => {
      state.currentFrame = i;
      renderAll();
    });
    timelineEl.appendChild(frameBtn);
  }
}

function renderStage() {
  stageEl.innerHTML = "";

  state.objects.forEach((object) => {
    const displayState = getFrameStateAt(object, state.currentFrame);
    const sprite = document.createElement("div");
    sprite.className = `sprite ${object.type}` + (object.id === state.selectedObjectId ? " selected" : "");
    sprite.dataset.objectId = object.id;
    sprite.style.left = `${displayState.x}px`;
    sprite.style.top = `${displayState.y}px`;
    sprite.style.width = `${Math.max(14, displayState.width)}px`;
    sprite.style.height = `${Math.max(14, displayState.height)}px`;
    sprite.style.background = object.type === "text" ? "transparent" : displayState.fill;
    sprite.style.transform = `rotate(${displayState.rotation}deg)`;
    sprite.style.fontSize = `${Math.max(18, displayState.height * 0.5)}px`;

    if (object.type === "text") {
      sprite.textContent = displayState.text || "Text";
    }

    sprite.addEventListener("pointerdown", (event) => {
      state.selectedObjectId = object.id;
      const stageRect = stageEl.getBoundingClientRect();
      sprite.setPointerCapture(event.pointerId);

      const dragInfo = {
        objectId: object.id,
        pointerStartX: event.clientX,
        pointerStartY: event.clientY,
        offsetX: event.clientX - stageRect.left - displayState.x,
        offsetY: event.clientY - stageRect.top - displayState.y,
      };

      function onMove(moveEvent) {
        const objectData = state.objects.find((entry) => entry.id === dragInfo.objectId);
        if (!objectData) return;
        ensureKeyframeForCurrentFrame(objectData);

        const localRect = stageEl.getBoundingClientRect();
        const nextX = clamp(moveEvent.clientX - localRect.left - dragInfo.offsetX, 18, 900);
        const nextY = clamp(moveEvent.clientY - localRect.top - dragInfo.offsetY, 18, 500);

        objectData.keyframes[state.currentFrame].x = nextX;
        objectData.keyframes[state.currentFrame].y = nextY;
        renderAll();
      }

      function onUp() {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      }

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      renderAll();
    });

    stageEl.appendChild(sprite);
  });

  stageStatusEl.textContent = `Frame ${state.currentFrame + 1}`;
}

function renderAll() {
  renderLayerList();
  renderStage();
  renderTimeline();
  updateInspectorFromSelection();
}

function addKeyframe() {
  const object = getSelectedObject();
  if (!object) return;

  const snapshot = getFrameStateAt(object, state.currentFrame);
  object.keyframes[state.currentFrame] = { ...snapshot };
  renderAll();
}

function togglePlayback() {
  if (state.playing) {
    state.playing = false;
    clearInterval(state.timer);
    playToggleEl.textContent = "Play";
    return;
  }

  state.playing = true;
  playToggleEl.textContent = "Pause";
  state.timer = setInterval(() => {
    state.currentFrame = state.currentFrame >= state.totalFrames - 1 ? 0 : state.currentFrame + 1;
    renderAll();
  }, 120);
}

function bindEvents() {
  document.querySelectorAll("[data-tool]").forEach((button) => {
    button.addEventListener("click", () => {
      createObject(button.dataset.tool);
    });
  });

  addLayerBtn.addEventListener("click", addNewLayer);
  addKeyframeBtn.addEventListener("click", addKeyframe);
  playToggleEl.addEventListener("click", togglePlayback);

  Object.entries(inspector).forEach(([key, input]) => {
    input.addEventListener("input", () => {
      syncSelectedObjectFromInspector();
    });
  });
}

function seedDemoScene() {
  const demoRect = {
    id: "obj-demo-1",
    type: "rect",
    layerId: "layer-1",
    keyframes: {
      0: { x: 180, y: 170, width: 120, height: 120, rotation: 0, fill: "#ff6b6b", text: "" },
      12: { x: 520, y: 210, width: 120, height: 120, rotation: 28, fill: "#ff6b6b", text: "" },
      18: { x: 660, y: 120, width: 150, height: 80, rotation: -18, fill: "#7c3aed", text: "" },
    },
  };

  const demoCircle = {
    id: "obj-demo-2",
    type: "circle",
    layerId: "layer-1",
    keyframes: {
      0: { x: 410, y: 290, width: 95, height: 95, rotation: 0, fill: "#38bdf8", text: "" },
      8: { x: 520, y: 250, width: 95, height: 95, rotation: 18, fill: "#38bdf8", text: "" },
      16: { x: 600, y: 315, width: 105, height: 105, rotation: -12, fill: "#34d399", text: "" },
    },
  };

  const demoText = {
    id: "obj-demo-3",
    type: "text",
    layerId: "layer-1",
    keyframes: {
      0: { x: 290, y: 90, width: 220, height: 50, rotation: 0, fill: "#f8fafc", text: "Animate Lab" },
      14: { x: 410, y: 90, width: 220, height: 50, rotation: 0, fill: "#f8fafc", text: "Animate Lab" },
    },
  };

  state.objects = [demoRect, demoCircle, demoText];
  state.selectedObjectId = demoText.id;
  state.nextObjectId = 10;
}

bindEvents();
seedDemoScene();
renderAll();
