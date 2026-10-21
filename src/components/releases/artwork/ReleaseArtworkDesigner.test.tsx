import { importArtworkImage, loadArtworkImage } from './imageLayer';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReleaseArtworkDesigner } from './ReleaseArtworkDesigner';
import { newArtworkDesign, artworkFile, drawArtwork } from './design';
vi.mock('./imageLayer', async original => ({ ...await original<typeof import('./imageLayer')>(), importArtworkImage: vi.fn(), loadArtworkImage: vi.fn() }));
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
    fireEvent.click(screen.getByRole('button', { name: /^Vinyl$/ }));
    fireEvent.change(screen.getByLabelText('Vinyl finish'), { target: { value: 'splatter' } });
    expect(drawArtwork).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ vinylStyle: 'splatter' }), 'vinyl', undefined);
  });
  it('blocks controls while the parent release is saving', () => {
    render(<ReleaseArtworkDesigner title="Night Shift" artist="War Dogs" onUse={vi.fn()} disabled />);
    expect(screen.getByRole('button', { name: 'Use as release artwork' })).toBeDisabled();
    expect(screen.getByLabelText('Design title')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Neon nights' })).toBeDisabled();
  });
});

it('restores the edited design and selected surface when the parent reopens the studio', () => {
  const onDraftChange = vi.fn();
  const { unmount } = render(<ReleaseArtworkDesigner title="Original" artist="Band" onUse={vi.fn()} onDraftChange={onDraftChange} />);
  fireEvent.change(screen.getByLabelText('Design title'), { target: { value: 'Keep this title' } });
  fireEvent.click(screen.getByRole('button', { name: /^Vinyl$/ }));
  fireEvent.change(screen.getByLabelText('Vinyl finish'), { target: { value: 'splatter' } });
  const draft = onDraftChange.mock.calls.at(-1)![0];
  unmount();
  render(<ReleaseArtworkDesigner title="Original" artist="Band" onUse={vi.fn()} draft={draft} />);
  expect(screen.getByLabelText('Design title')).toHaveValue('Keep this title');
  expect(screen.getByRole('button', { name: /^Vinyl$/ })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByLabelText('Vinyl finish')).toHaveValue('splatter');
});

it('imports a player image, retains crop edits and removes it on request', async () => {
  const image = { dataUrl: 'data:image/png;base64,test', zoom: 1, x: 0, y: 0 };
  vi.mocked(importArtworkImage).mockResolvedValueOnce(image);
  vi.mocked(loadArtworkImage).mockResolvedValue({ naturalWidth: 100, naturalHeight: 100 } as HTMLImageElement);
  const changed = vi.fn();
  render(<ReleaseArtworkDesigner title="Night Shift" artist="War Dogs" onUse={vi.fn()} onDraftChange={changed} />);
  fireEvent.change(screen.getByLabelText('Add artwork image'), { target: { files: [new File(['image'], 'photo.jpg', { type: 'image/jpeg' })] } });
  await screen.findByLabelText('Image zoom');
  fireEvent.change(screen.getByLabelText('Image zoom'), { target: { value: '2' } });
  fireEvent.change(screen.getByLabelText('Horizontal crop'), { target: { value: '0.5' } });
  expect(changed.mock.calls.at(-1)![0].design.image).toEqual({ ...image, zoom: 2, x: 0.5 });
  fireEvent.click(screen.getByRole('button', { name: 'Remove image' }));
  expect(screen.queryByLabelText('Image zoom')).toBeNull();
  expect(changed.mock.calls.at(-1)![0].design.image).toBeUndefined();
});
it('shows an image import failure without discarding the existing design', async () => {
  vi.mocked(importArtworkImage).mockRejectedValueOnce(new Error('Bad image'));
  const busy = vi.fn();
  render(<ReleaseArtworkDesigner title="Keep my title" artist="Band" onUse={vi.fn()} onBusyChange={busy} />);
  fireEvent.change(screen.getByLabelText('Add artwork image'), { target: { files: [new File(['bad'], 'broken.png', { type: 'image/png' })] } });
  expect(await screen.findByRole('alert')).toHaveTextContent('Bad image');
  expect(screen.getByLabelText('Design title')).toHaveValue('Keep my title');
  expect(busy.mock.calls).toEqual([[true], [false]]);
});

it('reopens a saved vinyl project with its selected format', async () => {
  const { serializeArtworkProject } = await import('./project');
  const { newArtworkDesign } = await import('./design');
  const file = new File([], 'design.json', { type: 'application/json' });
  Object.defineProperty(file, 'text', { value: async () => serializeArtworkProject({ design: newArtworkDesign('Restored'), surface: 'vinyl' }) });
  render(<ReleaseArtworkDesigner title="Original" artist="Band" onUse={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Open artwork design'), { target: { files: [file] } });
  await waitFor(() => expect(screen.getByLabelText('Design title')).toHaveValue('Restored'));
  expect(screen.getByRole('button', { name: 'Vinyl', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

it('keeps the current design when an imported project image cannot decode', async () => {
  const { serializeArtworkProject } = await import('./project');
  const { newArtworkDesign } = await import('./design');
  const file = new File([], 'design.json', { type: 'application/json' });
  const design = { ...newArtworkDesign('Broken project'), image: { dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHosAAAAASUVORK5CYII=', zoom: 1, x: 0, y: 0 } };
  Object.defineProperty(file, 'text', { value: async () => serializeArtworkProject({ design, surface: 'cd' }) });
  vi.mocked(loadArtworkImage).mockRejectedValueOnce(new Error('Image could not decode'));
  render(<ReleaseArtworkDesigner title="Keep my work" artist="Band" onUse={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Open artwork design'), { target: { files: [file] } });
  expect(await screen.findByRole('alert')).toHaveTextContent('Image could not decode');
  expect(screen.getByLabelText('Design title')).toHaveValue('Keep my work');
  expect(screen.getByRole('button', { name: 'Cover', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

it('applies a style without losing player content or surface, and reflects custom edits', async () => {
  const image = { dataUrl: 'data:image/png;base64,test', zoom: 2, x: 0.4, y: -0.3 };
  vi.mocked(loadArtworkImage).mockResolvedValue({ naturalWidth: 100, naturalHeight: 100 } as HTMLImageElement);
  const changed = vi.fn();
  const design = { ...newArtworkDesign('My album', 'My band'), subtitle: 'SIDE B', image };
  const view = render(<ReleaseArtworkDesigner title="" artist="" onUse={vi.fn()} draft={{ design, surface: 'vinyl' }} onDraftChange={changed} />);
  fireEvent.click(screen.getByRole('button', { name: 'Golden soul' }));
  const next = changed.mock.calls.at(-1)![0];
  expect(next).toMatchObject({ surface: 'vinyl', design: { title: 'My album', artist: 'My band', subtitle: 'SIDE B', image, font: 'serif', vinylStyle: 'colour' } });
  view.rerender(<ReleaseArtworkDesigner title="" artist="" onUse={vi.fn()} draft={next} onDraftChange={changed} />);
  expect(screen.getByRole('button', { name: 'Golden soul' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.change(screen.getByLabelText('Design accent'), { target: { value: '#123456' } });
  view.rerender(<ReleaseArtworkDesigner title="" artist="" onUse={vi.fn()} draft={changed.mock.calls.at(-1)![0]} />);
  expect(screen.getByRole('button', { name: 'Golden soul' })).toHaveAttribute('aria-pressed', 'false');
  await waitFor(() => expect(screen.queryByText('Loading image preview…')).toBeNull());
});

it('pairs an untouched default export with its editable snapshot and keeps it stable after later edits', async () => {
  const onUse = vi.fn();
  render(<ReleaseArtworkDesigner title="Original album" artist="Original band" onUse={onUse} />);
  fireEvent.click(screen.getByRole('button', { name: 'Use as release artwork' }));
  await waitFor(() => expect(onUse).toHaveBeenCalledTimes(1));
  const [file, selectedDraft] = onUse.mock.calls[0];
  expect(file).toBeInstanceOf(File);
  expect(selectedDraft).toEqual({ design: newArtworkDesign('Original album', 'Original band'), surface: 'cover' });
  expect(artworkFile).toHaveBeenCalledWith(selectedDraft.design, selectedDraft.surface);
  fireEvent.change(screen.getByLabelText('Design title'), { target: { value: 'Later draft' } });
  fireEvent.click(screen.getByRole('button', { name: 'Vinyl', exact: true }));
  expect(selectedDraft.design.title).toBe('Original album');
  expect(selectedDraft.surface).toBe('cover');
  expect(onUse).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Use as release artwork' }));
  await waitFor(() => expect(onUse).toHaveBeenCalledTimes(2));
  expect(onUse.mock.calls[1][1]).toMatchObject({ design: { title: 'Later draft' }, surface: 'vinyl' });
});
