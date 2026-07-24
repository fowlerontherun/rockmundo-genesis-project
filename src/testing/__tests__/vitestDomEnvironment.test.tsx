import React, { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

function EnvironmentSmoke() {
  const [name, setName] = useState('');
  const [status, setStatus] = useState('Waiting');
  return (
    <section>
      <h1>Vitest DOM smoke</h1>
      <label htmlFor="smoke-name">Festival name</label>
      <input id="smoke-name" value={name} onChange={(event) => setName(event.currentTarget.value)} onFocus={() => setStatus('Focused')} onBlur={() => setStatus('Blurred')} />
      <button type="button" onClick={() => setStatus(`Ready: ${name}`)}>Confirm</button>
      <p role="status">{status}</p>
    </section>
  );
}

describe('Vitest DOM environment', () => {
  it('renders, queries, types, clicks and unmounts React components', async () => {
    const user = userEvent.setup();
    const view = render(<EnvironmentSmoke />);

    expect(screen.getByRole('heading', { name: 'Vitest DOM smoke' })).toBeInTheDocument();
    const input = screen.getByLabelText('Festival name');
    await user.click(input);
    await user.keyboard('Genesis Fest');
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(screen.getByRole('status')).toHaveTextContent('Ready: Genesis Fest');
    view.unmount();
    expect(screen.queryByRole('heading', { name: 'Vitest DOM smoke' })).not.toBeInTheDocument();
  });
});
