import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
jest.mock('@/components/providers/trpc-provider', () => ({ api: { syncStatus: { getGoogleCoverage: { useQuery: jest.fn() } } } }));
jest.mock('@/components/connections/GoogleCoveragePanel', () => ({ GoogleCoveragePanel: () => <div>Coverage receipt fixture</div> }));
import { api } from '@/components/providers/trpc-provider';
import { GoogleHistoryImport } from '../google-history-import';

const props = { brandId: 'brand-1', adAccountId: 'acc-1', providerAccountId: 'gadsacct:brand-1:1234567890:9876543210',
  current: { startDate: '2025-09-17', endDate: '2026-09-16' }, baseline: { startDate: '2024-09-17', endDate: '2025-09-16' }, onImported: jest.fn() };
const query = jest.mocked(api.syncStatus.getGoogleCoverage.useQuery);
const fetchMock = jest.fn();
const refetch = jest.fn();
const response = (startDate: string, endDate: string) => ({ ok: true, json: async () => ({ success: true, adAccountId: 'acc-1', customerId: '1234567890', startDate, endDate, syncJobId: `job-${startDate}`, recordsSynced: 42 }) });
beforeEach(() => {
  jest.clearAllMocks();
  fetchMock.mockReset();
  global.fetch = fetchMock;
  query.mockReturnValue({ data: { availability: 'available', jobs: [] }, isLoading: false, isFetching: false, isError: false, refetch } as never);
  fetchMock.mockResolvedValueOnce(response(props.current.startDate, props.current.endDate)).mockResolvedValueOnce(response(props.baseline.startDate, props.baseline.endDate));
});
async function importHistory() {
  await userEvent.click(screen.getByRole('checkbox', { name: /Confirm reporting import/i }));
  await userEvent.click(screen.getByRole('button', { name: 'Import selected Google history' }));
}
it('never imports automatically and requires exact displayed reporting confirmation', () => {
  render(<GoogleHistoryImport {...props} />);
  expect(fetchMock).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Import selected Google history' })).toBeDisabled();
  expect(screen.getByText(/Account 1234567890/)).toBeInTheDocument();
  expect(screen.getByText(/2025-09-17.*2026-09-16/)).toBeInTheDocument();
});
it('does not launch imports while the receipt schema is missing', () => {
  query.mockReturnValue({ data: { availability: 'migration_required', jobs: [] }, isLoading: false, isError: false, refetch } as never);
  render(<GoogleHistoryImport {...props} />);
  expect(screen.getByText(/receipt migration.*required/i)).toBeInTheDocument();
  expect(screen.getByRole('checkbox')).toBeDisabled();
  expect(fetchMock).not.toHaveBeenCalled();
});
it('imports two exact windows sequentially with pinned account/customer then refreshes audit evidence', async () => {
  render(<GoogleHistoryImport {...props} />);
  await importHistory();
  await waitFor(() => expect(props.onImported).toHaveBeenCalledTimes(1));
  expect(fetchMock).toHaveBeenCalledTimes(2);
  for (const [i, window] of [props.current, props.baseline].entries()) {
    expect(fetchMock.mock.calls[i][0]).toBe('/api/sync/google');
    expect(JSON.parse(fetchMock.mock.calls[i][1].body)).toEqual({ brandId: 'brand-1', adAccountId: 'acc-1', expectedGoogleCustomerId: '1234567890', ...window });
  }
  expect(screen.getByRole('status')).toHaveTextContent(/2.*imports finished.*not campaign readiness/i);
  expect(screen.getByRole('checkbox')).not.toBeChecked();
});
it('stops after a failed first window without retries or reporting a zero-success import', async () => {
  fetchMock.mockReset().mockResolvedValue({ ok: false, json: async () => ({ error: 'Import failed' }) });
  render(<GoogleHistoryImport {...props} />);
  await importHistory();
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/Stopped after 0.*Import failed/i));
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(props.onImported).not.toHaveBeenCalled();
});
it('retains successful first-window evidence when the baseline fails, with no rollback', async () => {
  fetchMock.mockReset().mockResolvedValueOnce(response(props.current.startDate, props.current.endDate))
    .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Baseline unavailable' }) });
  render(<GoogleHistoryImport {...props} />);
  await importHistory();
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/Stopped after 1.*Baseline unavailable/i));
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(props.onImported).toHaveBeenCalledTimes(1);
  expect(screen.getByText(/job-2025-09-17/)).toBeInTheDocument();
});
it('rejects a successful HTTP response belonging to another customer and stops the baseline', async () => {
  fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => ({ success: true, adAccountId: 'acc-1', customerId: '9999999999', ...props.current, syncJobId: 'wrong', recordsSynced: 42 }) });
  render(<GoogleHistoryImport {...props} />);
  await importHistory();
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/scope.*mismatch/i));
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
it('resets approval and previous run results on an account/window change', async () => {
  const { rerender } = render(<GoogleHistoryImport {...props} />);
  await userEvent.click(screen.getByRole('checkbox'));
  rerender(<GoogleHistoryImport {...props} adAccountId='acc-2' />);
  expect(screen.getByRole('checkbox')).not.toBeChecked();
  expect(screen.getByRole('button', { name: 'Import selected Google history' })).toBeDisabled();
});
it('withholds imports when coverage availability is unknown or errored', () => {
  query.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch } as never);
  render(<GoogleHistoryImport {...props} />);
  expect(screen.getByRole('button', { name: 'Import selected Google history' })).toBeDisabled();
  expect(fetchMock).not.toHaveBeenCalled();
});
it('blocks incomplete or overlapping historical periods even with an available schema', () => {
  render(<GoogleHistoryImport {...props} baseline={props.current} />);
  expect(screen.getByRole('checkbox')).toBeDisabled();
  expect(fetchMock).not.toHaveBeenCalled();
});
it('cancels the next window when scope changes during the first server import', async () => {
  let complete: (value: unknown) => void = () => {};
  fetchMock.mockReset().mockImplementation(() => new Promise(resolve => { complete = resolve; }));
  const { rerender } = render(<GoogleHistoryImport {...props} />);
  await importHistory();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  rerender(<GoogleHistoryImport {...props} adAccountId='acc-2' />);
  complete(response(props.current.startDate, props.current.endDate));
  await waitFor(() => expect(screen.getByRole('checkbox')).not.toBeChecked());
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(props.onImported).not.toHaveBeenCalled();
});
