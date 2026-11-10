import { screen, userEvent } from '@testing-library/react-native';
import { almond, north, numeric, press, renderPicker, savedDraft } from './fixtures';
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());
test('opens at the current quantity; Cancel preserves quantity and instructions', async () => {
  const raw = JSON.stringify(savedDraft());
  const { storage } = await renderPicker(raw);
  await press('Edit packages for North Cafe');
  expect(screen.getByLabelText('Package quantity')).toHaveTextContent('2');
  await press('Increase packages');
  expect(screen.getByLabelText('Package quantity')).toHaveTextContent('3');
  expect(storage.read()).toBe(raw);
  await press('Cancel');
  expect(storage.read()).toBe(raw);
  expect(screen.getByText(north.phone)).toBeVisible();
});
test('Save commits the quantity while preserving instructions and the selected row phone', async () => {
  const { storage } = await renderPicker(JSON.stringify(savedDraft()));
  await press('Edit packages for North Cafe');
  await press('Increase packages');
  await press('Save packages');
  expect(storage.read()).toContain('"packages":3,"instructions":"Side door"');
  expect(screen.getByText(north.phone)).toBeVisible();
});
test.each([
  { stop: north, packages: 5, max: 5 },
  { stop: almond, packages: 99, max: 99 },
  { stop: numeric, packages: 120, max: 120 },
])('honors normalized maximum $max', async ({ stop, packages }) => {
  await renderPicker(JSON.stringify(savedDraft([{ stop, packages, instructions: 'Ring bell' }])));
  await press(`Edit packages for ${stop.name}`);
  expect(screen.getByLabelText('Increase packages')).toBeDisabled();
  await userEvent.press(screen.getByLabelText('Increase packages'));
  expect(screen.getByLabelText('Package quantity')).toHaveTextContent(String(packages));
});
test('minus cannot cross one', async () => {
  await renderPicker(
    JSON.stringify(savedDraft([{ stop: north, packages: 1, instructions: 'Side door' }]))
  );
  await press('Edit packages for North Cafe');
  expect(screen.getByLabelText('Decrease packages')).toBeDisabled();
  await userEvent.press(screen.getByLabelText('Decrease packages'));
  expect(screen.getByLabelText('Package quantity')).toHaveTextContent('1');
});
