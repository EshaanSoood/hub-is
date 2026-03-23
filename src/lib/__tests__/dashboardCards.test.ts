/// <reference types="node" />

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { dashboardCardRegistry, filterDashboardCards } from '../dashboardCards.ts';

describe('dashboard card registry', () => {
  test('contains expected card IDs', () => {
    const ids = dashboardCardRegistry.map((card) => card.id).sort();
    assert.deepEqual(ids, ['notifications', 'recent-files', 'recent-notes', 'service-status', 'tasks-today']);
  });

  test('each card has required registry fields', () => {
    for (const card of dashboardCardRegistry) {
      assert.ok(card.id.length > 0);
      assert.ok(card.title.length > 0);
      assert.ok(card.description.length > 0);
      assert.ok(card.target.length > 0);
      assert.ok(Array.isArray(card.requiredGlobalCapabilities));
      assert.ok(card.requiredGlobalCapabilities.length > 0);
      if (card.requiredProjectCapability) {
        assert.equal(card.projectScopeRequired, true);
      }
    }
  });

  test('filters cards by global and project capabilities', () => {
    const projects = [{ id: 'p1' }, { id: 'p2' }];

    const onlyHubView = filterDashboardCards(
      {
        globalCapabilities: ['hub.view'],
        projectCapabilities: {},
      },
      projects,
    ).map((card) => card.id);
    assert.deepEqual(onlyHubView.sort(), ['notifications', 'service-status']);

    const withTaskCapability = filterDashboardCards(
      {
        globalCapabilities: ['projects.view'],
        projectCapabilities: { p1: ['project.activity.view'] },
      },
      projects,
    ).map((card) => card.id);
    assert.deepEqual(withTaskCapability.sort(), ['tasks-today']);

    const withFileCapability = filterDashboardCards(
      {
        globalCapabilities: ['hub.view'],
        projectCapabilities: { p2: ['project.files.view'] },
      },
      projects,
    ).map((card) => card.id);
    assert.deepEqual(withFileCapability.sort(), ['notifications', 'recent-files', 'service-status']);
  });
});
