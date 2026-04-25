import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRef, useState } from 'react';
import { ModulePickerOverlay } from './ModulePickerOverlay';
import { tableContract } from './modulePickerPreviewContracts';

const ModulePickerHarness = () => {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  return (
    <div>
      <button type="button">Behind before</button>
      <button ref={triggerRef} type="button" onClick={() => setOpen(true)}>
        Open picker
      </button>
      <button type="button">Behind after</button>
      <ModulePickerOverlay
        open={open}
        onClose={() => setOpen(false)}
        triggerRef={triggerRef}
        sidebar={
          <div>
            <button type="button" data-dialog-autofocus>
              Table
            </button>
            <button type="button">Medium</button>
          </div>
        }
        preview={<div aria-hidden="true">Preview</div>}
        confirm={<button type="button">Add Table</button>}
      />
    </div>
  );
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const mockVisibleElements = () => {
  const rect = DOMRect.fromRect({ width: 1, height: 1 });
  const rects = {
    0: rect,
    length: 1,
    item: (index: number) => (index === 0 ? rect : null),
    [Symbol.iterator]: function* () {
      yield rect;
    },
  } as unknown as DOMRectList;
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue(rects);
};

describe('ModulePickerOverlay', () => {
  it('uses viewport-fixed overlay and panel classes', async () => {
    mockVisibleElements();
    render(
      <ModulePickerOverlay
        open
        onClose={() => undefined}
        sidebar={<button type="button">Table</button>}
        preview={<div aria-hidden="true">Preview</div>}
        confirm={<button type="button">Add Table</button>}
      />,
    );

    const overlay = document.querySelector('.module-picker-viewport-backdrop');
    const panel = await screen.findByRole('dialog', { name: 'Add Module' });

    expect(overlay).toHaveClass('fixed', 'inset-0', 'module-picker-viewport-backdrop');
    expect(panel).toHaveClass('fixed', 'module-picker-viewport-panel', 'module-picker-panel-size');
  });

  it('traps keyboard focus inside the picker and restores focus to the trigger', async () => {
    mockVisibleElements();
    const user = userEvent.setup();
    const { container } = render(<ModulePickerHarness />);

    const trigger = screen.getByRole('button', { name: 'Open picker' });
    await user.click(trigger);

    const firstPickerButton = await screen.findByRole('button', { name: 'Table' });
    await waitFor(() => {
      expect(firstPickerButton).toHaveFocus();
    });

    await user.tab();
    expect(screen.getByRole('button', { name: 'Medium' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Add Table' })).toHaveFocus();
    await user.tab();
    expect(firstPickerButton).toHaveFocus();

    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(screen.getByRole('button', { name: 'Add Table' })).toHaveFocus();

    container.querySelectorAll('button')[2]?.focus();
    expect(screen.getByRole('button', { name: 'Add Table' })).toHaveFocus();

    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Add Module' })).not.toBeInTheDocument();
    });
    expect(trigger).toHaveFocus();
  });

  it('maps table seed columns into the preview table contract', () => {
    const contract = tableContract({
      fields: ['Name', 'Status', 'Vibe'],
      rows: [['Your first record', 'Thriving', 'Organize anything into rows']],
    });

    const viewData = contract.dataByViewId['preview-view'];

    expect(contract.titleColumnLabel).toBe('Name');
    expect(viewData.schema?.fields.map((field) => field.name)).toEqual(['Status', 'Vibe']);
    expect(viewData.records[0]).toMatchObject({
      title: 'Your first record',
      fields: {
        'preview-field-0': 'Thriving',
        'preview-field-1': 'Organize anything into rows',
      },
    });
  });
});
