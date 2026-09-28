import { describe, it, expect } from 'vitest';
import { validatePhotoFile } from '../index';

describe('validatePhotoFile', () => {
  it('accepts a normal jpeg', () => {
    expect(validatePhotoFile({ type: 'image/jpeg', size: 500_000 })).toBeNull();
  });
  it('rejects a non-image type', () => {
    expect(validatePhotoFile({ type: 'application/pdf', size: 500_000 })).toMatch(/JPEG, PNG/);
  });
  it('rejects a file over the size limit', () => {
    expect(validatePhotoFile({ type: 'image/png', size: 11 * 1024 * 1024 })).toMatch(/10 MB/);
  });
  it('rejects an empty file', () => {
    expect(validatePhotoFile({ type: 'image/png', size: 0 })).toMatch(/empty/);
  });
  it('accepts heic at exactly the size limit', () => {
    expect(validatePhotoFile({ type: 'image/heic', size: 10 * 1024 * 1024 })).toBeNull();
  });
});
