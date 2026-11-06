import { deviceTimezone, syncTimezone } from '@/auth/timezone-sync';

const mockGet = jest.fn();
const mockPatch = jest.fn();
jest.mock('@/lib/api-client', () => ({
  api: {
    get: (path: string) => mockGet(path),
    patch: (path: string, body: unknown) => mockPatch(path, body),
  },
}));

const mockGetCalendars = jest.fn();
jest.mock('expo-localization', () => ({ getCalendars: () => mockGetCalendars() }));

beforeEach(() => {
  mockGet.mockReset();
  mockPatch.mockReset();
  mockGetCalendars.mockReset();
});

describe('deviceTimezone', () => {
  it('reads the phone’s IANA zone', () => {
    mockGetCalendars.mockReturnValue([{ timeZone: 'Asia/Singapore' }]);
    expect(deviceTimezone()).toBe('Asia/Singapore');
  });

  it('is null when the phone won’t say, rather than throwing', () => {
    mockGetCalendars.mockReturnValue([]);
    expect(deviceTimezone()).toBeNull();
    mockGetCalendars.mockImplementation(() => {
      throw new Error('no calendars');
    });
    expect(deviceTimezone()).toBeNull();
  });
});

describe('syncTimezone', () => {
  it('leaves a profile that is already right alone', async () => {
    mockGet.mockResolvedValue({ timezone: 'Asia/Singapore' });
    await expect(syncTimezone('Asia/Singapore')).resolves.toBe(false);
    expect(mockPatch).not.toHaveBeenCalled();
  });

  it('moves the profile to where the phone is', async () => {
    mockGet.mockResolvedValue({ timezone: 'Asia/Singapore' });
    mockPatch.mockResolvedValue({ timezone: 'Asia/Tokyo' });
    await expect(syncTimezone('Asia/Tokyo')).resolves.toBe(true);
    expect(mockGet).toHaveBeenCalledWith('/auth/me');
    expect(mockPatch).toHaveBeenCalledWith('/auth/me', { timezone: 'Asia/Tokyo' });
  });
});
