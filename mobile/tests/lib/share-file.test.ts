import { shareFile } from '@/lib/share-file';

const mockWrite = jest.fn(async (_bytes: Uint8Array) => undefined);
const mockDelete = jest.fn();
let mockExists = false;
jest.mock('expo-file-system', () => ({
  Paths: { cache: 'file:///cache' },
  File: jest.fn().mockImplementation((dir: string, name: string) => ({
    uri: `${dir}/${name}`,
    get exists() {
      return mockExists;
    },
    delete: mockDelete,
    write: mockWrite,
  })),
}));

const mockShare = jest.fn(async (_uri: string, _options: object) => undefined);
jest.mock('expo-sharing', () => ({
  shareAsync: (uri: string, options: object) => mockShare(uri, options),
}));

beforeEach(() => {
  mockWrite.mockClear();
  mockDelete.mockClear();
  mockShare.mockClear();
  mockExists = false;
});

describe('shareFile', () => {
  it('writes the bytes to the cache and opens the share sheet on that file', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    await shareFile(bytes, 'transactions-2026-11-11.xlsx', 'application/x');

    expect(mockWrite).toHaveBeenCalledWith(bytes);
    expect(mockShare).toHaveBeenCalledWith('file:///cache/transactions-2026-11-11.xlsx', {
      mimeType: 'application/x',
      dialogTitle: 'transactions-2026-11-11.xlsx',
    });
  });

  it('replaces an earlier file of the same name rather than failing on it', async () => {
    mockExists = true;
    await shareFile(new Uint8Array([1]), 'expenses-template.xlsx', 'application/x');
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockWrite).toHaveBeenCalledTimes(1);
  });
});
