/**
 * Oxlint configuration
 *
 * Oxlint is a fast JavaScript/TypeScript linter.
 * See: https://oxlint.com
 */

export default {
  // Disable rules that conflict with Prettier
  // Enable stricter TypeScript checking
  // Enable React rules for web components
  // Enable Node.js rules for API and worker

  // Categories
  correctness: "warn",
  suspicious: "warn",
  perf: "warn",
  style: "off", // Handled by Prettier
  nursery: "off",

  // TypeScript-specific
  typescript: {
    recommend: true,
    // Additional type safety rules
    "no-unnecessary-conditional": "warn",
    "no-unnecessary-type-assertion": "warn",
  },

  // React rules (for web)
  react: {
    recommend: true,
  },

  // Node.js rules (for API/worker)
  node: {
    recommend: true,
  },

  // Ignored patterns
  ignore: [
    "node_modules/",
    "dist/",
    "build/",
    ".next/",
    "coverage/",
    "*.config.js",
    "*.config.ts",
  ],
};
