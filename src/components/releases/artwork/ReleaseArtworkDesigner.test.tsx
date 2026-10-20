import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReleaseArtworkDesigner } from './ReleaseArtworkDesigner';
import { artworkFile, drawArtwork } from './design';
vi.mock('./design', async importOriginal => ({ ...await importOriginal<typeof import('./design')>(), drawArtwork: vi.fn(), artworkFile: vi.fn(), downloadArtworkFile: vi.fn() }));

beforeEach(() => { vi.clearAllMocks(); vi.mocked(artworkFile).mockResolvedValue(new File(['png'], 'artwork.png', { type: 'image/png' })); });
describe('player artwork studio', () => {
  it('only selects artwork after an explicit action and includes current edits', async () => {
    const onUse = vi.fn();
    render(<ReleaseArtworkDesigner title="Night Shift" artist="War Dogs" onUse={onUse} />);
    expect(onUse).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Design title'), { target: { value: 'New title' } });
    fireEvent.click(screen.getByRole('button', { name: 'CD ring' }));
    fireEvent.click(screen.getByRole('button', { name: 'Use as release artwork' }));
    await waitFor(() => expect(onUse).toHaveBeenCalledTimes(1));
    expect(artworkFile).toHaveBeenCalledWith(expect.objectContaining({ title: 'New title' }), 'cd');
    expect(await screen.findByText('Artwork selected. Save the release to apply it.')).toBeVisible();
  });
  it('reports upload errors without claiming artwork was selected', async () => {
    render(<ReleaseArtworkDesigner title="Night Shift" artist="War Dogs" onUse={async () => { throw new Error('Upload denied'); }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Use as release artwork' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Upload denied');
    expect(screen.queryByText('Artwork selected. Save the release to apply it.')).toBeNull();
  });
  it('renders vinyl finish changes with the same renderer as the export', () => {
    render(<ReleaseArtworkDesigner title="Night Shift" artist="War Dogs" onUse={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Vinyl', exact: true }));
    fireEvent.change(screen.getByLabelText('Vinyl finish'), { target: { value: 'splatter' } });
    expect(drawArtwork).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ vinylStyle: 'splatter' }), 'vinyl');
  });
  it('blocks controls while the parent release is saving', () => {
    render(<ReleaseArtworkDesigner title="Night Shift" artist="War Dogs" onUse={vi.fn()} disabled />);
    expect(screen.getByRole('button', { name: 'Use as release artwork' })).toBeDisabled();
    expect(screen.getByLabelText('Design title')).toBeDisabled();
  });
});
