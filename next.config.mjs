/** @type {import('next').NextConfig} */
export default {
  experimental: {
    typedRoutes: true,
    // Matches lib/photos.MAX_PHOTO_BYTES (10 MB) and the Storage bucket's own file_size_limit.
    // Next's default Server Action body limit is 1 MB, which would silently reject most photos.
    serverActions: { bodySizeLimit: '10mb' },
  },
};
