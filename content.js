(() => {
  const PANEL_ID = 'layout-highlighter-panel';
  const STYLE_ID = 'layout-highlighter-style';
  const PANEL_TITLE = 'Layout Highlighter';

  let layers = [];
  let colorCounter = 0;

  // --- State Management ---

  function saveState() {
    const state = { layers, colorCounter };
    chrome.storage.local.set({ 'layoutHighlighterState': JSON.stringify(state) });
  }

  function loadState() {
    return new Promise(resolve => {
      chrome.storage.local.get('layoutHighlighterState', (result) => {
        if (result.layoutHighlighterState) {
          const state = JSON.parse(result.layoutHighlighterState);
          layers = state.layers || [];
          colorCounter = state.colorCounter || 0;
        }
        resolve();
      });
    });
  }

  // --- Color & Layer Logic ---

  /**
   * Converts an HSL color value to HEX.
   * Assumes h, s, and l are contained in the set [0, 360], [0, 100], and [0, 100].
   * @returns {string} The HEX representation.
   */
  function hslToHex(h, s, l) {
    s /= 100;
    l /= 100;
    let c = (1 - Math.abs(2 * l - 1)) * s,
      x = c * (1 - Math.abs((h / 60) % 2 - 1)),
      m = l - c / 2,
      r = 0, g = 0, b = 0;

    if (0 <= h && h < 60) {
      r = c; g = x; b = 0;
    } else if (60 <= h && h < 120) {
      r = x; g = c; b = 0;
    } else if (120 <= h && h < 180) {
      r = 0; g = c; b = x;
    } else if (180 <= h && h < 240) {
      r = 0; g = x; b = c;
    } else if (240 <= h && h < 300) {
      r = x; g = 0; b = c;
    } else if (300 <= h && h < 360) {
      r = c; g = 0; b = x;
    }
    
    r = Math.round((r + m) * 255).toString(16);
    g = Math.round((g + m) * 255).toString(16);
    b = Math.round((b + m) * 255).toString(16);

    if (r.length == 1) r = "0" + r;
    if (g.length == 1) g = "0" + g;
    if (b.length == 1) b = "0" + b;

    return "#" + r + g + b;
  }

  function getNextColor() {
    const hue = (colorCounter * 75) % 360;
    const saturation = 90; // High saturation for vivid colors
    const lightness = 55;  // Not too dark, not too light
    const color = hslToHex(hue, saturation, lightness);
    colorCounter++;
    return color;
  }

  function clearAllLayers() {
    layers = [];
    colorCounter = 0;
    renderLayers();
    updateStyles();
    saveState();
  }

  function addLayer() {
    const selector = 'body' + ' > *'.repeat(layers.length + 1);
    const newLayer = {
      id: Date.now(),
      selector: selector,
      color: getNextColor(),
      enabled: true,
    };
    layers.push(newLayer);
    renderLayers();
    updateStyles();
    saveState();
  }

  function deleteLayer(layerId) {
    layers = layers.filter(l => l.id !== layerId);
    renderLayers();
    updateStyles();
    saveState();
  }
  
  // --- DOM & UI ---

  function updateStyles() {
    let styleEl = document.getElementById(STYLE_ID);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = STYLE_ID;
      document.head.appendChild(styleEl);
    }
    const cssRules = layers
      .filter(layer => layer.enabled)
      .map(layer => `${layer.selector} { outline: 2px solid ${layer.color} !important; }`)
      .join('\n');
    styleEl.textContent = cssRules + `\n#${PANEL_ID}, #${PANEL_ID} * { outline: none !important; }`;
  }

  function renderLayers() {
    const layersList = document.getElementById('lh-layers-list');
    if (!layersList) return;
    layersList.innerHTML = '';

    layers.forEach((layer, index) => {
      const listItem = document.createElement('li');
      listItem.className = 'lh-layer-item';
      listItem.dataset.layerId = layer.id;
      listItem.innerHTML = `
        <input type="checkbox" class="lh-layer-toggle" ${layer.enabled ? 'checked' : ''} title="Включить/отключить слой">
        <input type="color" class="lh-layer-color-picker" value="${layer.color}" title="Изменить цвет">
        <span class="lh-layer-selector" title="${layer.selector}">Слой №${index + 1}</span>
        <button class="lh-delete-layer" title="Удалить слой">&times;</button>
      `;
      layersList.appendChild(listItem);
    });
  }
  
  function attachLayerEventListeners() {
      const layersList = document.getElementById('lh-layers-list');
      if (!layersList) return;
      
      layersList.addEventListener('click', (e) => {
          const target = e.target;
          const listItem = target.closest('.lh-layer-item');
          if (!listItem) return;
          const layerId = parseInt(listItem.dataset.layerId);
          const layer = layers.find(l => l.id === layerId);
          if (!layer) return;

          if (target.classList.contains('lh-layer-toggle')) {
              layer.enabled = target.checked;
              updateStyles();
              saveState();
          } else if (target.classList.contains('lh-delete-layer')) {
              deleteLayer(layerId);
          }
      });

      layersList.addEventListener('change', (e) => {
          const target = e.target;
          if (target.classList.contains('lh-layer-color-picker')) {
              const listItem = target.closest('.lh-layer-item');
              if (!listItem) return;
              const layerId = parseInt(listItem.dataset.layerId);
              const layer = layers.find(l => l.id === layerId);
              if (layer) {
                  layer.color = target.value;
                  updateStyles();
                  saveState();
              }
          }
      });
  }

  function createPanel() {
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    const version = chrome.runtime.getManifest().version;

    panel.innerHTML = `
      <div class="lh-panel-header">
        <h2>${PANEL_TITLE} <span class="lh-version">(${version})</span></h2>
        <div class="lh-panel-controls">
            <button id="lh-minimize-button" title="Свернуть/развернуть">&ndash;</button>
            <button id="lh-close-button" title="Закрыть панель">&times;</button>
        </div>
      </div>
      <div class="lh-panel-body">
        <button id="lh-add-layer-button">Добавить слой</button>
        <div class="lh-layers-list-container">
          <div class="lh-layers-header">
            <h3>Слои</h3>
            <button id="lh-clear-layers-button">Очистить всё</button>
          </div>
          <ul id="lh-layers-list"></ul>
        </div>
      </div>
    `;
    document.body.appendChild(panel);

    const header = panel.querySelector('.lh-panel-header');
    
    header.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return; // Only drag with left mouse button

        let shiftX = e.clientX - panel.getBoundingClientRect().left;
        let shiftY = e.clientY - panel.getBoundingClientRect().top;

        function moveAt(pageX, pageY) {
            panel.style.left = pageX - shiftX + 'px';
            panel.style.top = pageY - shiftY + 'px';
        }

        function onMouseMove(event) {
            moveAt(event.pageX, event.pageY);
        }

        document.addEventListener('mousemove', onMouseMove);

        document.addEventListener('mouseup', function onMouseUp() {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        });
    });

    header.ondragstart = () => false;

    document.getElementById('lh-minimize-button').addEventListener('click', () => {
        panel.classList.toggle('lh-panel--collapsed');
    });

    document.getElementById('lh-close-button').addEventListener('click', () => {
      clearAllLayers();
      panel.style.display = 'none';
    });
    document.getElementById('lh-add-layer-button').addEventListener('click', addLayer);
    document.getElementById('lh-clear-layers-button').addEventListener('click', clearAllLayers);
    
    renderLayers();
    updateStyles();
    attachLayerEventListeners();
  }

  // --- Initialization ---

  async function init() {
      const existingPanel = document.getElementById(PANEL_ID);
      if (existingPanel) {
        const isVisible = existingPanel.style.display !== 'none';
        existingPanel.style.display = isVisible ? 'none' : 'block';
      } else {
        await loadState();
        createPanel();
      }
  }

  init();

})(); 