import { renderRouter, screen } from 'expo-router/testing-library';
import StopsRoute from '../app/index';

describe('empty route shell', () => {
  it('shows the two workflow steps and prevents continuing without stops', () => {
    renderRouter({ index: StopsRoute }, { initialUrl: '/' });
    expect(screen.getByText('Stops')).toBeVisible();
    expect(screen.getByText('Instructions')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });
});
