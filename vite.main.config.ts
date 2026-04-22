import { defineConfig } from 'vite';
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'fs';
import { resolve, join } from 'path';

// Plugin that copies native .node binaries into the Vite build output
// so the main process can require() them relative to __dirname at runtime.
//
// Safety guarantees:
//   1. Only copies the arch-matching .node for the current platform/arch
//      (matches the loader expectation in fs-handlers.ts).
//   2. Clears stale *.node files from dest before copying to avoid
//      accumulating old-arch binaries when switching architectures.
//   3. If build:native was never run (no matching .node in src), skips
//      silently rather than throwing — dev loop still works, tests skip.
function copyNativePlugin() {
  return {
    name: 'copy-native-modules',
    closeBundle() {
      const srcDir = resolve(__dirname, 'src/main/native');
      const destDir = resolve(__dirname, '.vite/build/native');

      // If src/main/native doesn't exist yet (build:native never run), skip.
      if (!existsSync(srcDir)) {
        console.log('[copy-native] no native dir found, skipping');
        return;
      }

      // Only copy the arch-matching binary — matches the loader in fs-handlers.ts.
      const expected = `index.${process.platform}-${process.arch}.node`;
      const srcPath = join(srcDir, expected);
      if (!existsSync(srcPath)) {
        console.log(`[copy-native] ${expected} not found in src/main/native, skipping`);
        return;
      }

      // Clear any stale *.node files in dest so old-arch binaries don't linger.
      if (existsSync(destDir)) {
        for (const f of readdirSync(destDir).filter((f) => f.endsWith('.node'))) {
          rmSync(join(destDir, f));
        }
      }

      mkdirSync(destDir, { recursive: true });
      copyFileSync(srcPath, join(destDir, expected));
    },
  };
}

// https://vitejs.dev/config
export default defineConfig({
  plugins: [copyNativePlugin()],
  build: {
    rollupOptions: {
      external: [
        'electron',
        'node-pty',
        'fsevents',
        'electron-squirrel-startup',
      ],
    },
  },
});
