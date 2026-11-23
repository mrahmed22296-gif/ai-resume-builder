/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      // Same-site proxy for the Firebase auth handler. Lets the app use its
      // own host as authDomain so Google sign-in survives browsers that
      // partition third-party storage (the default firebaseapp.com helper
      // domain cannot hand the credential back otherwise).
      {
        source: "/__/auth/:path*",
        destination: "https://resume-builder-access.firebaseapp.com/__/auth/:path*",
      },
    ];
  },
};

export default nextConfig;
