import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { REPO_ROOT } from './paths.ts';

interface DomAccessibilityEntry {
  tag: string;
  role: string | null;
  name: string | null;
  text: string | null;
  id: string | null;
  domPath: string;
  ariaLabel: string | null;
  ariaLabelledby: string | null;
  hidden: boolean;
  visuallyHidden: boolean;
  documentOrder: number;
}

interface ShellContract {
  bodyChildren: DomAccessibilityEntry[];
  appRootChildren: DomAccessibilityEntry[];
  persistentNodes: DomAccessibilityEntry[];
}

interface LandmarkEntry extends DomAccessibilityEntry {
  landmarkParentDomPath: string | null;
}

type SectionEntry = DomAccessibilityEntry;

interface HeadingEntry {
  level: number;
  text: string;
  tag: string;
  role: string | null;
  name: string | null;
  domPath: string;
  hidden: boolean;
  visuallyHidden: boolean;
  documentOrder: number;
}

interface FocusStopEntry {
  index: number;
  tag: string;
  role: string | null;
  name: string | null;
  text: string | null;
  value: string | null;
  domPath: string;
  documentOrder: number;
  states: string[];
  transcript: string;
}

interface AnnouncementEntry {
  index: number;
  timeMs: number;
  kind: string;
  role: string | null;
  politeness: string | null;
  text: string;
  domPath: string;
}

interface HubHomeAuditReport {
  route: string;
  pageTitle: string;
  capturedAt: string;
  shell: ShellContract;
  sections: SectionEntry[];
  landmarks: LandmarkEntry[];
  headings: HeadingEntry[];
  focusStops: FocusStopEntry[];
  announcements: AnnouncementEntry[];
  ariaSnapshots: {
    body: string | null;
    main: string | null;
  };
  failures: string[];
}

interface PageStructureSnapshot {
  shell: ShellContract;
  sections: SectionEntry[];
  landmarks: LandmarkEntry[];
  headings: HeadingEntry[];
}

const ANNOUNCEMENT_RECORDER_KEY = '__hubHomeAuditAnnouncements';
const DEFAULT_ROUTE = '/projects';
const MAX_FOCUS_STOPS = 250;

const shellSelectors = [
  'a[href="#main-content"]',
  'header',
  'nav[aria-label="Primary"]',
  'main#main-content',
  '[role="status"]',
  '[role="alert"]',
  '[aria-live]',
].join(', ');

const landmarkSelectors = [
  '[role]',
  'header',
  'nav',
  'main',
  'aside',
  'form',
  'section[aria-label]',
  'section[aria-labelledby]',
].join(', ');

const artifactPath = (...parts: string[]): string => resolve(REPO_ROOT, 'e2e', 'artifacts', 'hub-home-audit', ...parts);

const formatName = (name: string | null): string => (name ? `"${name}"` : '(unnamed)');

const formatEntryLine = (entry: DomAccessibilityEntry): string => {
  const parts = [entry.role || entry.tag];
  if (entry.name) {
    parts.push(formatName(entry.name));
  }
  if (entry.visuallyHidden) {
    parts.push('[visually-hidden]');
  } else if (entry.hidden) {
    parts.push('[hidden]');
  }
  parts.push(`{${entry.domPath}}`);
  return parts.join(' ');
};

const formatHeadingLine = (heading: HeadingEntry): string => {
  const visibilityLabel = heading.visuallyHidden ? 'visually-hidden' : heading.hidden ? 'hidden' : 'visible';
  return `h${heading.level} "${heading.text}" [${visibilityLabel}] {${heading.domPath}}`;
};

const formatFocusLine = (stop: FocusStopEntry): string => `${stop.index}. ${stop.transcript} {${stop.domPath}}`;

const formatAnnouncementLine = (entry: AnnouncementEntry): string =>
  `+${entry.timeMs}ms ${entry.politeness || entry.role || 'live'} "${entry.text}" {${entry.domPath}}`;

const toMarkdownList = (items: string[]): string => {
  if (items.length === 0) {
    return '- No failures detected in this first-pass collector run.\n';
  }
  return `${items.map((item) => `- ${item}`).join('\n')}\n`;
};

const renderLandmarkTree = (landmarks: LandmarkEntry[]): string => {
  const byPath = new Map(landmarks.map((entry) => [entry.domPath, entry]));
  const depthFor = (entry: LandmarkEntry): number => {
    let depth = 0;
    let parentPath = entry.landmarkParentDomPath;
    while (parentPath) {
      depth += 1;
      parentPath = byPath.get(parentPath)?.landmarkParentDomPath ?? null;
    }
    return depth;
  };

  return landmarks
    .map((entry) => `${'  '.repeat(depthFor(entry))}${formatEntryLine(entry)}`)
    .join('\n')
    .concat('\n');
};

const formatSectionLine = (entry: SectionEntry, index: number): string =>
  `${index + 1}. ${entry.name ? `"${entry.name}"` : '(anonymous)'} ${entry.hidden ? '[hidden]' : entry.visuallyHidden ? '[visually-hidden]' : '[visible]'} {${entry.domPath}}`;

const analyzeFailures = (report: HubHomeAuditReport): string[] => {
  const failures: string[] = [];

  const mains = report.landmarks.filter((entry) => entry.role === 'main' || entry.tag === 'main');
  if (mains.length !== 1) {
    failures.push(`Expected exactly one main landmark on Hub Home, found ${mains.length}.`);
  }

  const primaryNav = report.landmarks.find(
    (entry) => entry.role === 'navigation' && entry.name === 'Primary',
  );
  if (!primaryNav) {
    failures.push('Missing the named primary navigation landmark "Primary".');
  }

  const skipLink = report.shell.persistentNodes.find(
    (entry) => entry.tag === 'a' && entry.name === 'Skip to main content',
  );
  if (!skipLink) {
    failures.push('Skip link to main content was not found in the persistent shell nodes.');
  }

  const levelOneHeadings = report.headings.filter((heading) => heading.level === 1);
  if (levelOneHeadings.length !== 1) {
    failures.push(
      `Expected one level-1 heading in the Hub Home outline, found ${levelOneHeadings.length}: ${levelOneHeadings.map((heading) => `"${heading.text}"`).join(', ')}.`,
    );
  }

  for (let index = 1; index < report.headings.length; index += 1) {
    const previous = report.headings[index - 1];
    const current = report.headings[index];
    if (current.level - previous.level > 1) {
      failures.push(
        `Heading level jump from h${previous.level} "${previous.text}" to h${current.level} "${current.text}".`,
      );
    }
  }

  const unnamedInteractiveStops = report.focusStops.filter(
    (stop) => ['button', 'link', 'textbox', 'combobox', 'checkbox', 'radio', 'menuitem'].includes(stop.role || '')
      && !(stop.name || stop.text || stop.value),
  );
  for (const stop of unnamedInteractiveStops) {
    failures.push(`Focusable ${stop.role || stop.tag} at ${stop.domPath} has no accessible name in the tab order.`);
  }

  const positiveTabIndexStops = report.focusStops.filter((stop) => stop.states.some((state) => state.startsWith('tabindex ')));
  for (const stop of positiveTabIndexStops) {
    failures.push(`Focusable ${stop.role || stop.tag} at ${stop.domPath} uses a positive tabindex (${stop.states.find((state) => state.startsWith('tabindex '))}).`);
  }

  const documentOrderDrops: string[] = [];
  for (let index = 1; index < report.focusStops.length; index += 1) {
    const previous = report.focusStops[index - 1];
    const current = report.focusStops[index];
    if (current.documentOrder < previous.documentOrder) {
      documentOrderDrops.push(
        `Focus order moved backward from ${previous.domPath} to ${current.domPath} before the cycle ended.`,
      );
    }
  }
  failures.push(...documentOrderDrops);

  const duplicateLandmarkNames = new Map<string, number>();
  for (const landmark of report.landmarks) {
    if (!landmark.name) {
      continue;
    }
    const key = `${landmark.role || landmark.tag}:${landmark.name}`;
    duplicateLandmarkNames.set(key, (duplicateLandmarkNames.get(key) || 0) + 1);
  }
  for (const [key, count] of duplicateLandmarkNames.entries()) {
    if (count > 1) {
      failures.push(`Duplicate landmark name detected for ${key} (${count} instances).`);
    }
  }

  const duplicateAnnouncements = new Set<string>();
  for (let index = 1; index < report.announcements.length; index += 1) {
    const previous = report.announcements[index - 1];
    const current = report.announcements[index];
    if (previous.text === current.text && previous.politeness === current.politeness) {
      duplicateAnnouncements.add(`${current.politeness || current.role || 'live'} "${current.text}"`);
    }
  }
  for (const duplicate of duplicateAnnouncements) {
    failures.push(`Duplicate consecutive live region announcement detected: ${duplicate}.`);
  }

  if (report.focusStops.length >= MAX_FOCUS_STOPS) {
    failures.push(`Focus transcript hit the collector cap at ${MAX_FOCUS_STOPS} stops before cycling back to the start.`);
  }

  return failures;
};

const collectStructure = async (page: Page): Promise<PageStructureSnapshot> =>
  page.evaluate(({ shellSelectorList, landmarkSelectorList }) => {
    const normalizeSpace = (value: string | null | undefined): string | null => {
      if (!value) {
        return null;
      }
      const next = value.replace(/\s+/g, ' ').trim();
      return next || null;
    };

    const isElementHidden = (element: Element): boolean => {
      if (!(element instanceof HTMLElement)) {
        return false;
      }
      if (element.hidden || element.getAttribute('aria-hidden') === 'true') {
        return true;
      }
      const style = window.getComputedStyle(element);
      return style.display === 'none' || style.visibility === 'hidden';
    };

    const isElementVisuallyHidden = (element: Element): boolean => {
      if (!(element instanceof HTMLElement)) {
        return false;
      }
      if (element.classList.contains('sr-only')) {
        return true;
      }
      const style = window.getComputedStyle(element);
      return style.position === 'absolute'
        && Number.parseFloat(style.width || '0') <= 1
        && Number.parseFloat(style.height || '0') <= 1
        && style.overflow === 'hidden';
    };

    const textFromIds = (value: string | null): string | null => {
      const ids = normalizeSpace(value);
      if (!ids) {
        return null;
      }
      return normalizeSpace(
        ids
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent || '')
          .join(' '),
      );
    };

    const toDomPath = (element: Element): string => {
      const segments: string[] = [];
      let current: Element | null = element;
      while (current) {
        const tag = current.tagName.toLowerCase();
        const id = current.id ? `#${current.id}` : '';
        if (id) {
          segments.unshift(`${tag}${id}`);
          break;
        }
        const parent = current.parentElement;
        if (!parent) {
          segments.unshift(tag);
          break;
        }
        const sameTagSiblings = Array.from(parent.children).filter((child) => child.tagName === current?.tagName);
        const index = sameTagSiblings.indexOf(current) + 1;
        segments.unshift(`${tag}:nth-of-type(${index})`);
        current = parent;
      }
      return segments.join(' > ');
    };

    const inferRole = (element: Element): string | null => {
      const explicitRole = normalizeSpace(element.getAttribute('role'));
      if (explicitRole) {
        return explicitRole;
      }

      if (element instanceof HTMLAnchorElement && element.href) {
        return 'link';
      }
      if (element instanceof HTMLButtonElement) {
        return 'button';
      }
      if (element instanceof HTMLInputElement) {
        const type = element.type.toLowerCase();
        if (type === 'checkbox') {
          return 'checkbox';
        }
        if (type === 'radio') {
          return 'radio';
        }
        if (type === 'search') {
          return 'searchbox';
        }
        if (type === 'submit' || type === 'button' || type === 'reset') {
          return 'button';
        }
        return 'textbox';
      }
      if (element instanceof HTMLTextAreaElement) {
        return 'textbox';
      }
      if (element instanceof HTMLSelectElement) {
        return 'combobox';
      }
      if (element instanceof HTMLElement) {
        const tag = element.tagName.toLowerCase();
        if (tag === 'main') {
          return 'main';
        }
        if (tag === 'nav') {
          return 'navigation';
        }
        if (tag === 'header') {
          return 'banner';
        }
        if (tag === 'aside') {
          return 'complementary';
        }
        if (tag === 'form') {
          return 'form';
        }
        if (/^h[1-6]$/.test(tag)) {
          return 'heading';
        }
        if (tag === 'section' && (element.hasAttribute('aria-label') || element.hasAttribute('aria-labelledby'))) {
          return 'region';
        }
        if (tag === 'ul' || tag === 'ol') {
          return 'list';
        }
        if (tag === 'li') {
          return 'listitem';
        }
        if (tag === 'img') {
          return 'img';
        }
      }

      return null;
    };

    const inferName = (element: Element): string | null => {
      const ariaLabel = normalizeSpace(element.getAttribute('aria-label'));
      if (ariaLabel) {
        return ariaLabel;
      }

      const labelledByText = textFromIds(element.getAttribute('aria-labelledby'));
      if (labelledByText) {
        return labelledByText;
      }

      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
        const labelText = normalizeSpace(Array.from(element.labels || []).map((label) => label.textContent || '').join(' '));
        if (labelText) {
          return labelText;
        }
        const placeholder = normalizeSpace(element.getAttribute('placeholder'));
        if (placeholder) {
          return placeholder;
        }
      }

      if (element instanceof HTMLImageElement) {
        const alt = normalizeSpace(element.alt);
        if (alt) {
          return alt;
        }
      }

      const title = normalizeSpace(element.getAttribute('title'));
      if (title) {
        return title;
      }

      const textContent = normalizeSpace(element.textContent);
      if (textContent) {
        return textContent;
      }

      return null;
    };

    const allElements = Array.from(document.querySelectorAll('*'));
    const documentOrderMap = new Map<Element, number>(allElements.map((element, index) => [element, index]));

    const toEntry = (element: Element): DomAccessibilityEntry => ({
      tag: element.tagName.toLowerCase(),
      role: inferRole(element),
      name: inferName(element),
      text: normalizeSpace(element.textContent),
      id: normalizeSpace(element.id),
      domPath: toDomPath(element),
      ariaLabel: normalizeSpace(element.getAttribute('aria-label')),
      ariaLabelledby: normalizeSpace(element.getAttribute('aria-labelledby')),
      hidden: isElementHidden(element),
      visuallyHidden: isElementVisuallyHidden(element),
      documentOrder: documentOrderMap.get(element) ?? -1,
    });

    const persistentElements = Array.from(document.querySelectorAll(shellSelectorList));
    const landmarkElements = Array.from(document.querySelectorAll(landmarkSelectorList));
    const sectionElements = Array.from(document.querySelectorAll('section'));
    const headingElements = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]'));
    const bodyChildren = Array.from(document.body.children).map((element) => toEntry(element));
    const appRoot = document.body.firstElementChild;
    const appRootChildren = appRoot ? Array.from(appRoot.children).map((element) => toEntry(element)) : [];

    const landmarks = landmarkElements.map((element) => {
      const parentLandmark = element.parentElement?.closest(landmarkSelectorList);
      return {
        ...toEntry(element),
        landmarkParentDomPath: parentLandmark ? toDomPath(parentLandmark) : null,
      };
    });

    const sections = sectionElements.map((element) => toEntry(element));

    const headings = headingElements.map((element) => {
      const explicitLevel = normalizeSpace(element.getAttribute('aria-level'));
      const tagName = element.tagName.toLowerCase();
      const level = explicitLevel
        ? Number.parseInt(explicitLevel, 10)
        : /^h[1-6]$/.test(tagName)
          ? Number.parseInt(tagName.slice(1), 10)
          : 0;

      return {
        level,
        text: normalizeSpace(element.textContent) || '(empty heading)',
        tag: tagName,
        role: inferRole(element),
        name: inferName(element),
        domPath: toDomPath(element),
        hidden: isElementHidden(element),
        visuallyHidden: isElementVisuallyHidden(element),
        documentOrder: documentOrderMap.get(element) ?? -1,
      };
    });

    return {
      shell: {
        bodyChildren,
        appRootChildren,
        persistentNodes: persistentElements.map((element) => toEntry(element)),
      },
      sections,
      landmarks,
      headings,
    };
  }, { shellSelectorList: shellSelectors, landmarkSelectorList: landmarkSelectors });

const readFocusStop = async (page: Page, index: number): Promise<FocusStopEntry | null> =>
  page.evaluate((focusIndex) => {
    const normalizeSpace = (value: string | null | undefined): string | null => {
      if (!value) {
        return null;
      }
      const next = value.replace(/\s+/g, ' ').trim();
      return next || null;
    };

    const toDomPath = (element: Element): string => {
      const segments: string[] = [];
      let current: Element | null = element;
      while (current) {
        const tag = current.tagName.toLowerCase();
        const id = current.id ? `#${current.id}` : '';
        if (id) {
          segments.unshift(`${tag}${id}`);
          break;
        }
        const parent = current.parentElement;
        if (!parent) {
          segments.unshift(tag);
          break;
        }
        const sameTagSiblings = Array.from(parent.children).filter((child) => child.tagName === current?.tagName);
        const siblingIndex = sameTagSiblings.indexOf(current) + 1;
        segments.unshift(`${tag}:nth-of-type(${siblingIndex})`);
        current = parent;
      }
      return segments.join(' > ');
    };

    const inferRole = (element: HTMLElement): string | null => {
      const explicitRole = normalizeSpace(element.getAttribute('role'));
      if (explicitRole) {
        return explicitRole;
      }
      if (element instanceof HTMLAnchorElement && element.href) {
        return 'link';
      }
      if (element instanceof HTMLButtonElement) {
        return 'button';
      }
      if (element instanceof HTMLInputElement) {
        const type = element.type.toLowerCase();
        if (type === 'checkbox') {
          return 'checkbox';
        }
        if (type === 'radio') {
          return 'radio';
        }
        if (type === 'search') {
          return 'searchbox';
        }
        if (type === 'submit' || type === 'button' || type === 'reset') {
          return 'button';
        }
        return 'textbox';
      }
      if (element instanceof HTMLTextAreaElement) {
        return 'textbox';
      }
      if (element instanceof HTMLSelectElement) {
        return 'combobox';
      }
      const tag = element.tagName.toLowerCase();
      if (tag === 'main') {
        return 'main';
      }
      if (tag === 'nav') {
        return 'navigation';
      }
      return null;
    };

    const textFromIds = (value: string | null): string | null => {
      const ids = normalizeSpace(value);
      if (!ids) {
        return null;
      }
      return normalizeSpace(
        ids
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent || '')
          .join(' '),
      );
    };

    const inferName = (element: HTMLElement): string | null => {
      const ariaLabel = normalizeSpace(element.getAttribute('aria-label'));
      if (ariaLabel) {
        return ariaLabel;
      }
      const labelledBy = textFromIds(element.getAttribute('aria-labelledby'));
      if (labelledBy) {
        return labelledBy;
      }
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
        const labelText = normalizeSpace(Array.from(element.labels || []).map((label) => label.textContent || '').join(' '));
        if (labelText) {
          return labelText;
        }
        const placeholder = normalizeSpace(element.getAttribute('placeholder'));
        if (placeholder) {
          return placeholder;
        }
      }
      const title = normalizeSpace(element.getAttribute('title'));
      if (title) {
        return title;
      }
      return normalizeSpace(element.textContent);
    };

    const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!activeElement || activeElement === document.body) {
      return null;
    }

    const allElements = Array.from(document.querySelectorAll('*'));
    const role = inferRole(activeElement);
    const name = inferName(activeElement);
    const text = normalizeSpace(activeElement.textContent);
    const value = activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement || activeElement instanceof HTMLSelectElement
      ? normalizeSpace(activeElement.value)
      : null;

    const states: string[] = [];
    const expanded = activeElement.getAttribute('aria-expanded');
    if (expanded === 'true' || expanded === 'false') {
      states.push(expanded === 'true' ? 'expanded' : 'collapsed');
    }
    const selected = activeElement.getAttribute('aria-selected');
    if (selected === 'true') {
      states.push('selected');
    }
    const checked = activeElement.getAttribute('aria-checked');
    if (checked === 'true' || checked === 'false') {
      states.push(checked === 'true' ? 'checked' : 'not checked');
    } else if (activeElement instanceof HTMLInputElement && activeElement.type === 'checkbox') {
      states.push(activeElement.checked ? 'checked' : 'not checked');
    }
    const pressed = activeElement.getAttribute('aria-pressed');
    if (pressed === 'true' || pressed === 'false') {
      states.push(pressed === 'true' ? 'pressed' : 'not pressed');
    }
    const current = activeElement.getAttribute('aria-current');
    if (current) {
      states.push(current === 'true' ? 'current' : `current ${current}`);
    }
    if (activeElement.hasAttribute('disabled') || activeElement.getAttribute('aria-disabled') === 'true') {
      states.push('disabled');
    }
    if (activeElement.tabIndex > 0) {
      states.push(`tabindex ${activeElement.tabIndex}`);
    }

    const transcriptParts = [name || text || value || 'Unnamed'];
    if (role) {
      transcriptParts.push(role);
    }
    transcriptParts.push(...states);
    if (value && value !== name && value !== text) {
      transcriptParts.push(`value "${value}"`);
    }

    return {
      index: focusIndex,
      tag: activeElement.tagName.toLowerCase(),
      role,
      name,
      text,
      value,
      domPath: toDomPath(activeElement),
      documentOrder: allElements.indexOf(activeElement),
      states,
      transcript: transcriptParts.join(', '),
    };
  }, index);

const collectFocusStops = async (page: Page): Promise<FocusStopEntry[]> => {
  await page.evaluate(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    const body = document.body;
    if (body && !body.hasAttribute('tabindex')) {
      body.setAttribute('tabindex', '-1');
    }
    body?.focus({ preventScroll: true });
    if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body) {
      document.activeElement.blur();
    }
  });

  const stops: FocusStopEntry[] = [];
  const seenKeys = new Set<string>();
  let repeatedKeyCount = 0;

  for (let index = 1; index <= MAX_FOCUS_STOPS; index += 1) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(60);
    const stop = await readFocusStop(page, index);
    if (!stop) {
      repeatedKeyCount += 1;
      if (repeatedKeyCount >= 3) {
        break;
      }
      continue;
    }

    const key = `${stop.domPath}|${stop.role || stop.tag}|${stop.name || stop.text || stop.value || ''}`;
    if (seenKeys.has(key)) {
      break;
    }

    seenKeys.add(key);
    repeatedKeyCount = 0;
    stops.push(stop);
  }

  return stops;
};

const installAnnouncementRecorder = async (page: Page): Promise<void> => {
  await page.addInitScript((storageKey) => {
    const normalizeSpace = (value) => {
      if (typeof value !== 'string') {
        return null;
      }
      const next = value.replace(/\s+/g, ' ').trim();
      return next || null;
    };

    const toDomPath = (element) => {
      const segments = [];
      let current = element;
      while (current) {
        const tag = current.tagName.toLowerCase();
        const id = current.id ? `#${current.id}` : '';
        if (id) {
          segments.unshift(`${tag}${id}`);
          break;
        }
        const parent = current.parentElement;
        if (!parent) {
          segments.unshift(tag);
          break;
        }
        const sameTagSiblings = Array.from(parent.children).filter((child) => child.tagName === current.tagName);
        const index = sameTagSiblings.indexOf(current) + 1;
        segments.unshift(`${tag}:nth-of-type(${index})`);
        current = parent;
      }
      return segments.join(' > ');
    };

    const store = [];
    const lastValues = new Map();
    const selector = '[aria-live], [role="status"], [role="alert"]';
    const start = Math.round(performance.now());

    const readPoliteness = (element) => {
      const explicit = normalizeSpace(element.getAttribute('aria-live'));
      if (explicit) {
        return explicit;
      }
      const role = normalizeSpace(element.getAttribute('role'));
      if (role === 'alert') {
        return 'assertive';
      }
      if (role === 'status') {
        return 'polite';
      }
      return null;
    };

    const recordEntries = (kind) => {
      const elements = Array.from(document.querySelectorAll(selector));
      for (const element of elements) {
        const text = normalizeSpace(element.textContent);
        if (!text) {
          continue;
        }
        const domPath = toDomPath(element);
        const lastText = lastValues.get(domPath);
        if (lastText === text) {
          continue;
        }
        lastValues.set(domPath, text);
        store.push({
          index: store.length + 1,
          timeMs: Math.round(performance.now()) - start,
          kind,
          role: normalizeSpace(element.getAttribute('role')),
          politeness: readPoliteness(element),
          text,
          domPath,
        });
      }
    };

    const observer = new MutationObserver(() => {
      recordEntries('mutation');
    });

    const startObserver = () => {
      observer.observe(document.documentElement, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['aria-live', 'role', 'aria-label', 'aria-labelledby'],
      });
      recordEntries('initial');
    };

    if (document.documentElement) {
      startObserver();
    } else {
      window.addEventListener('DOMContentLoaded', startObserver, { once: true });
    }

    window[storageKey] = store;
  }, ANNOUNCEMENT_RECORDER_KEY);
};

const readAnnouncements = async (page: Page): Promise<AnnouncementEntry[]> =>
  page.evaluate((storageKey) => {
    const raw = window[storageKey];
    return Array.isArray(raw) ? raw : [];
  }, ANNOUNCEMENT_RECORDER_KEY);

const readAriaSnapshot = async (page: Page, selector: string): Promise<string | null> => {
  const locator = page.locator(selector).first();
  const count = await locator.count();
  if (count === 0) {
    return null;
  }
  return locator.ariaSnapshot().catch(() => null);
};

export const waitForHubHomeAuditReady = async (page: Page): Promise<void> => {
  await expect(page.locator('#main-content')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: /Project Lens|Stream/i }).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeAttached({ timeout: 30_000 });
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
  await page.waitForTimeout(500);
};

export const collectHubHomeAudit = async (page: Page): Promise<HubHomeAuditReport> => {
  const structure = await collectStructure(page);
  const focusStops = await collectFocusStops(page);
  const announcements = await readAnnouncements(page);
  const bodyAriaSnapshot = await readAriaSnapshot(page, 'body');
  const mainAriaSnapshot = await readAriaSnapshot(page, '#main-content');

  const baseReport: HubHomeAuditReport = {
    route: DEFAULT_ROUTE,
    pageTitle: await page.title(),
    capturedAt: new Date().toISOString(),
    shell: structure.shell,
    sections: structure.sections,
    landmarks: structure.landmarks,
    headings: structure.headings,
    focusStops,
    announcements,
    ariaSnapshots: {
      body: bodyAriaSnapshot,
      main: mainAriaSnapshot,
    },
    failures: [],
  };

  return {
    ...baseReport,
    failures: analyzeFailures(baseReport),
  };
};

export const writeHubHomeAuditArtifacts = async (report: HubHomeAuditReport): Promise<string> => {
  const outputDir = artifactPath();
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  const manifest = {
    route: report.route,
    pageTitle: report.pageTitle,
    capturedAt: report.capturedAt,
    outputDir: 'e2e/artifacts/hub-home-audit',
    counts: {
      bodyChildren: report.shell.bodyChildren.length,
      appRootChildren: report.shell.appRootChildren.length,
      persistentNodes: report.shell.persistentNodes.length,
      sections: report.sections.length,
      landmarks: report.landmarks.length,
      headings: report.headings.length,
      focusStops: report.focusStops.length,
      announcements: report.announcements.length,
      failures: report.failures.length,
    },
  };

  await Promise.all([
    writeFile(artifactPath('manifest.json'), JSON.stringify(manifest, null, 2), 'utf8'),
    writeFile(artifactPath('hub-home-shell.json'), JSON.stringify(report.shell, null, 2), 'utf8'),
    writeFile(
      artifactPath('hub-home-shell.txt'),
      [
        'Body children',
        ...report.shell.bodyChildren.map((entry) => `- ${formatEntryLine(entry)}`),
        '',
        'App root children',
        ...report.shell.appRootChildren.map((entry) => `- ${formatEntryLine(entry)}`),
        '',
        'Persistent shell nodes',
        ...report.shell.persistentNodes.map((entry) => `- ${formatEntryLine(entry)}`),
        '',
      ].join('\n'),
      'utf8',
    ),
    writeFile(artifactPath('hub-home-sections.json'), JSON.stringify(report.sections, null, 2), 'utf8'),
    writeFile(
      artifactPath('hub-home-sections.txt'),
      `${report.sections.map((entry, index) => formatSectionLine(entry, index)).join('\n')}\n`,
      'utf8',
    ),
    writeFile(artifactPath('hub-home-landmarks.json'), JSON.stringify(report.landmarks, null, 2), 'utf8'),
    writeFile(artifactPath('hub-home-landmarks.txt'), renderLandmarkTree(report.landmarks), 'utf8'),
    writeFile(artifactPath('hub-home-headings.json'), JSON.stringify(report.headings, null, 2), 'utf8'),
    writeFile(artifactPath('hub-home-headings.txt'), `${report.headings.map(formatHeadingLine).join('\n')}\n`, 'utf8'),
    writeFile(artifactPath('hub-home-focus-stops.json'), JSON.stringify(report.focusStops, null, 2), 'utf8'),
    writeFile(artifactPath('hub-home-focus-stops.txt'), `${report.focusStops.map(formatFocusLine).join('\n')}\n`, 'utf8'),
    writeFile(artifactPath('hub-home-announcements.json'), JSON.stringify(report.announcements, null, 2), 'utf8'),
    writeFile(
      artifactPath('hub-home-announcements.txt'),
      report.announcements.length ? `${report.announcements.map(formatAnnouncementLine).join('\n')}\n` : 'No live region announcements were captured.\n',
      'utf8',
    ),
    writeFile(artifactPath('hub-home-aria-snapshot.txt'), report.ariaSnapshots.body || 'Unavailable.\n', 'utf8'),
    writeFile(artifactPath('hub-home-main-aria-snapshot.txt'), report.ariaSnapshots.main || 'Unavailable.\n', 'utf8'),
    writeFile(artifactPath('hub-home-failures.md'), toMarkdownList(report.failures), 'utf8'),
  ]);

  return outputDir;
};

export const runHubHomeAudit = async (page: Page): Promise<{ outputDir: string; report: HubHomeAuditReport }> => {
  await installAnnouncementRecorder(page);
  await page.goto(DEFAULT_ROUTE, { waitUntil: 'domcontentloaded' });
  await waitForHubHomeAuditReady(page);
  const report = await collectHubHomeAudit(page);
  const outputDir = await writeHubHomeAuditArtifacts(report);
  return { outputDir, report };
};
