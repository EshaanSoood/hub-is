import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { HomeProjectNamingDialog } from './HomeProjectNamingDialog';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('HomeProjectNamingDialog', () => {
  it('focuses and selects the project name when the dialog opens', async () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);

    render(
      <HomeProjectNamingDialog
        error={null}
        onSubmit={() => undefined}
        onValueChange={() => undefined}
        open
        projectName="Sunday Desk"
        saving={false}
      />,
    );

    const input = await screen.findByRole('textbox', { name: 'Space name' });
    await waitFor(() => {
      expect(input).toHaveFocus();
    });
    expect(input).toHaveValue('Sunday Desk');
    expect((input as HTMLInputElement).selectionStart).toBe(0);
    expect((input as HTMLInputElement).selectionEnd).toBe('Sunday Desk'.length);
  });

  it('marks the input invalid and disables save while the name is empty', () => {
    render(
      <HomeProjectNamingDialog
        error="Space name is required."
        onSubmit={() => undefined}
        onValueChange={() => undefined}
        open
        projectName="   "
        saving={false}
      />,
    );

    const input = screen.getByRole('textbox', { name: 'Space name' });
    const saveButton = screen.getByRole('button', { name: 'Save name' });
    const error = screen.getByRole('alert');

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'home-project-name-error');
    expect(error).toHaveAttribute('id', 'home-project-name-error');
    expect(saveButton).toBeDisabled();
  });
});
