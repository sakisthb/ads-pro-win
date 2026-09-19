/** @jest-environment node */
jest.mock('superjson', () => ({ __esModule: true, default: { serialize: (value: unknown) => value, deserialize: (value: unknown) => value } }));
jest.mock('@/lib/auth', () => ({ getSession: jest.fn() }));
jest.mock('@/lib/db', () => ({ prisma: { organization: { findUnique: jest.fn() }, adAccount: { findFirst: jest.fn() } } }));
jest.mock('@/lib/organization-authorization', () => ({ OrganizationAuthorizationError: class extends Error {}, organizationRoles: ['owner', 'admin', 'member', 'viewer'], requireOrganizationRoleForUser: jest.fn() }));
jest.mock('@/lib/google-hygiene-provider', () => ({ googleHygieneProvider: jest.fn() }));

import { prisma } from '@/lib/db';
import { requireOrganizationRoleForUser } from '@/lib/organization-authorization';
import { googleHygieneProvider } from '@/lib/google-hygiene-provider';
import { googleHygieneRouter } from '../google-hygiene';

const scope = { brandId: 'fixture-brand', adAccountId: 'fixture-account' };
const scan = jest.fn();
const caller = () => googleHygieneRouter.createCaller({ session: { user: { id: 'fixture-owner' }, expires: '2099-01-01' }, prisma });
const snapshot = { customerId: '1111111111', scannedAt: '2026-09-19T18:00:00.000Z', coverage: {
  campaigns: { scanned: 1, limited: false }, ads: { scanned: 0, limited: false }, keywords: { scanned: 0, limited: false }, campaignAssets: { scanned: 0, limited: false }, conversionActions: { scanned: 0, limited: false },
}, campaigns: [{ id: '10', name: 'Search', status: 'ENABLED', channelType: 'SEARCH', primaryStatus: 'ELIGIBLE', primaryStatusReasons: [], targetContentNetwork: true }], ads: [], keywords: [], campaignAssets: [], conversionActions: [] };

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(requireOrganizationRoleForUser).mockResolvedValue({ organizationId: 'fixture-org', membership: { role: 'owner' } } as never);
  jest.mocked(prisma.organization.findUnique).mockResolvedValue({ id: 'fixture-org', slug: 'real-org' } as never);
  jest.mocked(prisma.adAccount.findFirst).mockResolvedValue({ id: 'fixture-account', accountId: '1111111111', isActive: true, accessToken: 'encrypted-fixture', refreshToken: null, tokenExpiry: null } as never);
  jest.mocked(googleHygieneProvider).mockResolvedValue({ customerId: '1111111111', scan } as never);
  scan.mockResolvedValue(snapshot);
});

it('returns a native classified audit for the exact owned brand and account', async () => {
  const result = await caller().scan(scope);
  expect(prisma.adAccount.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'fixture-account', platform: 'google', brand: { id: 'fixture-brand', organizationId: 'fixture-org' } } }));
  expect(result).toMatchObject({ customerId: '1111111111', complete: true, counts: { repairable_in_adpd: 1 }, findings: [{ id: 'network:campaign:10' }] });
});

it.each(['member', 'viewer'])('rejects %s before account credentials or provider access', async role => {
  jest.mocked(requireOrganizationRoleForUser).mockResolvedValue({ organizationId: 'fixture-org', membership: { role } } as never);
  await expect(caller().scan(scope)).rejects.toThrow('Insufficient organization permissions');
  expect(prisma.adAccount.findFirst).not.toHaveBeenCalled();
  expect(googleHygieneProvider).not.toHaveBeenCalled();
});

it('rejects a foreign, inactive or unconnected account before provider access', async () => {
  jest.mocked(prisma.adAccount.findFirst).mockResolvedValueOnce(null);
  await expect(caller().scan(scope)).rejects.toThrow('Owned Google account not found');
  jest.mocked(prisma.adAccount.findFirst).mockResolvedValueOnce({ id: 'fixture-account', accountId: 'gads:pending:fixture-brand', isActive: false, accessToken: null } as never);
  await expect(caller().scan(scope)).rejects.toThrow('connected active Google Ads spend account');
  expect(googleHygieneProvider).not.toHaveBeenCalled();
});

it('reports provider failure explicitly without leaking raw details or returning empty success', async () => {
  scan.mockRejectedValue(new Error('Authorization Bearer PRIVATE-SECRET'));
  await expect(caller().scan(scope)).rejects.toThrow('Native Google hygiene scan unavailable');
  await expect(caller().scan(scope)).rejects.not.toThrow('PRIVATE-SECRET');
});
