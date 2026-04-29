import { describe, expect, it } from 'vitest';
import type { ContractWidgetConfig } from '../WidgetGrid';
import { buildWidgetTrays, COMPACT_WIDGET_TRAY_SIZE_SPANS, WIDGET_TRAY_SIZE_SPANS } from './useWidgetTrays';

const widget = (
  widgetInstanceId: string,
  sizeTier: ContractWidgetConfig['size_tier'],
): ContractWidgetConfig => ({
  widget_instance_id: widgetInstanceId,
  widget_type: 'tasks',
  size_tier: sizeTier,
  lens: 'project',
});

describe('buildWidgetTrays', () => {
  it('uses tray spans that keep large widgets at half width with smaller medium and small footprints', () => {
    expect(WIDGET_TRAY_SIZE_SPANS.L).toEqual({ columnSpan: 6, rowSpan: 4 });
    expect(WIDGET_TRAY_SIZE_SPANS.M).toEqual({ columnSpan: 4, rowSpan: 3 });
    expect(WIDGET_TRAY_SIZE_SPANS.S).toEqual({ columnSpan: 3, rowSpan: 2 });
  });

  it('uses compact spans for the mobile widgets overlay', () => {
    expect(COMPACT_WIDGET_TRAY_SIZE_SPANS.L).toEqual({ columnSpan: 4, rowSpan: 4 });
    expect(COMPACT_WIDGET_TRAY_SIZE_SPANS.M).toEqual({ columnSpan: 4, rowSpan: 3 });
    expect(COMPACT_WIDGET_TRAY_SIZE_SPANS.S).toEqual({ columnSpan: 2, rowSpan: 2 });
  });

  it('packs widgets into each tray in insertion order', () => {
    const trays = buildWidgetTrays([
      widget('large-1', 'L'),
      widget('large-2', 'L'),
      widget('medium-1', 'M'),
      widget('small-1', 'S'),
    ]);

    expect(trays).toHaveLength(1);
    expect(trays[0].placements.map(({ widget: placedWidget }) => placedWidget.widget_instance_id)).toEqual([
      'large-1',
      'large-2',
      'medium-1',
      'small-1',
    ]);
    expect(trays[0].placements.map(({ columnStart, rowStart }) => ({ columnStart, rowStart }))).toEqual([
      { columnStart: 1, rowStart: 1 },
      { columnStart: 7, rowStart: 1 },
      { columnStart: 1, rowStart: 5 },
      { columnStart: 5, rowStart: 5 },
    ]);
  });

  it('creates a new tray when the next insertion-order widget cannot fit the current tray', () => {
    const trays = buildWidgetTrays([
      widget('medium-1', 'M'),
      widget('medium-2', 'M'),
      widget('medium-3', 'M'),
      widget('medium-4', 'M'),
      widget('medium-5', 'M'),
      widget('medium-6', 'M'),
      widget('medium-7', 'M'),
      widget('small-after-overflow', 'S'),
    ]);

    expect(trays).toHaveLength(2);
    expect(trays[0].placements.map(({ widget: placedWidget }) => placedWidget.widget_instance_id)).toEqual([
      'medium-1',
      'medium-2',
      'medium-3',
      'medium-4',
      'medium-5',
      'medium-6',
    ]);
    expect(trays[1].placements.map(({ widget: placedWidget }) => placedWidget.widget_instance_id)).toEqual([
      'medium-7',
      'small-after-overflow',
    ]);
  });

  it('drops the extra tray once its final widget is removed and trays are rebuilt', () => {
    const fullTrays = buildWidgetTrays([
      widget('large-1', 'L'),
      widget('large-2', 'L'),
      widget('large-3', 'L'),
      widget('large-4', 'L'),
      widget('large-5', 'L'),
    ]);
    const rebuiltTrays = buildWidgetTrays([
      widget('large-1', 'L'),
      widget('large-2', 'L'),
      widget('large-3', 'L'),
      widget('large-4', 'L'),
    ]);

    expect(fullTrays).toHaveLength(2);
    expect(rebuiltTrays).toHaveLength(1);
    expect(rebuiltTrays[0].placements.map(({ widget: placedWidget }) => placedWidget.widget_instance_id)).toEqual([
      'large-1',
      'large-2',
      'large-3',
      'large-4',
    ]);
  });

  it('packs compact mobile trays with full-width medium and large widgets', () => {
    const trays = buildWidgetTrays([
      widget('medium-1', 'M'),
      widget('large-1', 'L'),
      widget('small-1', 'S'),
    ], 'compact');

    expect(trays).toHaveLength(2);
    expect(trays[0].placements.map(({ widget: placedWidget }) => placedWidget.widget_instance_id)).toEqual([
      'medium-1',
      'large-1',
    ]);
    expect(trays[1].placements[0]).toMatchObject({
      columnSpan: 2,
      rowSpan: 2,
      columnStart: 1,
      rowStart: 1,
    });
  });
});
