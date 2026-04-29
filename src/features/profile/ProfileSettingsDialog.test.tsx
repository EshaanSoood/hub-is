import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProfileSettingsDialog } from './ProfileSettingsDialog';
import type { SessionSummary } from '../../types/domain';

const sessionSummary: SessionSummary = {
  userId: 'user-1',
  name: 'Owner Person',
  firstName: 'Owner',
  lastName: 'Person',
  email: 'owner@example.com',
  role: 'Owner',
  projectMemberships: [],
  globalCapabilities: [],
  projectCapabilities: {},
  calendarFeedUrl: '',
};

describe('ProfileSettingsDialog', () => {
  afterEach(() => {
    cleanup();
  });

  it('previews an uploaded image and saves the selected data URL', async () => {
    const onSaveProfileImage = vi.fn();
    const image = new File(['avatar'], 'avatar.png', { type: 'image/png' });

    render(
      <ProfileSettingsDialog
        open
        onClose={vi.fn()}
        sessionSummary={sessionSummary}
        profileImageUrl={null}
        onSaveProfileImage={onSaveProfileImage}
      />,
    );

    await userEvent.upload(screen.getByLabelText('Choose profile image'), image);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    });

    const preview = screen.getByAltText('Profile preview');
    expect(preview).toHaveAttribute('src', expect.stringMatching(/^data:image\/png;base64,/));

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSaveProfileImage).toHaveBeenCalledWith(expect.stringMatching(/^data:image\/png;base64,/));
  });

  it('cancels a selected preview without saving', async () => {
    const onSaveProfileImage = vi.fn();
    const currentImageUrl = 'data:image/png;base64,current';
    const image = new File(['avatar'], 'avatar.png', { type: 'image/png' });

    render(
      <ProfileSettingsDialog
        open
        onClose={vi.fn()}
        sessionSummary={sessionSummary}
        profileImageUrl={currentImageUrl}
        onSaveProfileImage={onSaveProfileImage}
      />,
    );

    await userEvent.upload(screen.getByLabelText('Choose profile image'), image);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByAltText('Profile preview')).toHaveAttribute('src', currentImageUrl);
    expect(onSaveProfileImage).not.toHaveBeenCalled();
  });
});
