/**
 * Render diagrams at a readable size, including after a theme change.
 */

import { mermaidConfig, styleMermaidSource } from './mermaid-theme';

const diagrams = [];
let renderQueue;
let renderId = 0;

async function renderDiagrams() {
  const isDark = Theme.resolvedTheme === 'dark';
  mermaid.initialize(mermaidConfig(isDark));

  for (const { source, element, backup } of diagrams) {
    try {
      const { svg, bindFunctions } = await mermaid.render(
        `diagram-${renderId++}`,
        styleMermaidSource(source, isDark)
      );
      element.innerHTML = svg;

      // Keep labels at their designed size. The container scrolls on narrow screens.
      const image = element.querySelector('svg');
      const width = image.viewBox.baseVal.width;
      if (width > 0) {
        image.style.width = `${width}px`;
        image.style.maxWidth = 'none';
      }

      bindFunctions?.(element);
      backup.classList.add('d-none');
      element.hidden = false;
    } catch (error) {
      // A broken diagram must not hide its source or prevent the others rendering.
      element.hidden = true;
      backup.classList.remove('d-none');
      console.error('Unable to render diagram:', error);
    }
  }
}

function queueRender() {
  // Serialize theme updates so an older render cannot replace a newer one.
  renderQueue = renderQueue.then(renderDiagrams);
}

function refreshTheme(event) {
  if (event.source === window && event.data?.id === Theme.eventId) {
    queueRender();
  }
}

export function loadMermaid() {
  if (typeof mermaid === 'undefined' || diagrams.length > 0) {
    return;
  }

  document.querySelectorAll('code.language-mermaid').forEach((code) => {
    const backup = code.parentElement;
    const element = document.createElement('div');
    element.className = 'mermaid';
    element.tabIndex = 0;
    element.setAttribute('role', 'region');
    element.setAttribute('aria-label', 'Diagram (scroll to explore)');
    element.hidden = true;
    backup.after(element);
    diagrams.push({ source: code.textContent, element, backup });
  });

  // Font metrics must be final before Mermaid measures labels and connectors.
  renderQueue = document.fonts.ready;
  queueRender();

  if (Theme.isToggleable) {
    window.addEventListener('message', refreshTheme);
  }
}
