import { svelte } from "@sveltejs/vite-plugin-svelte";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { defineConfig, type Plugin, type PluginOption } from "vite";

const setOutDir = (mode: string) => {
  switch (mode) {
    case "development":
      return "./test-vault/.obsidian/plugins/chess-tree";
    case "production":
    case "production-min":
      return "build";
  }
};

/**
 * base64-asset — reads imports ending in `?base64` (e.g.
 * `../assets/wood.jpg?base64`) as a base64 string default-exported from a
 * JS module, embedding the image into main.js instead of emitting it as a
 * separate file.
 */
function base64Asset(): Plugin {
  return {
    name: "base64-asset",
    enforce: "pre",
    resolveId(source, importer) {
      if (!source.endsWith("?base64")) return null;
      const filePath = source.slice(0, -"?base64".length);
      const id =
        importer && !filePath.startsWith("/")
          ? resolve(dirname(importer), filePath)
          : resolve(filePath);
      return `\0${id}?base64`;
    },
    load(id) {
      if (!id.endsWith("?base64")) return null;
      const filePath = id.slice(1, -"?base64".length); // strip leading \0 and trailing query
      if (!existsSync(filePath)) {
        this.error(`base64-asset: file not found: ${filePath}`);
      }
      const b64 = readFileSync(filePath).toString("base64");
      return `export default ${JSON.stringify(b64)};`;
    },
  };
}

export default defineConfig(({ mode }) => {
  const isMin = mode === "production-min";
  return {
    plugins: [
      base64Asset(),
      svelte({
        compilerOptions: {
          compatibility: {
            componentApi: 4,
          },
          cssHash: ({
            hash,
            css,
          }: {
            hash: (str: string) => string;
            css: string;
          }) => `svelte-${hash(css)}`,
        },
      }) as PluginOption,
    ],
    build: {
      lib: {
        entry: "src/main",
        formats: ["cjs"],
      },
      rollupOptions: {
        output: {
          entryFileNames: "main.js",
          assetFileNames: "styles.css",
          sourcemapBaseUrl: pathToFileURL(
            `${__dirname}/test-vault/.obsidian/plugins/chess-tree/`,
          ).toString(),
        },
        external: [
          "obsidian",
          "electron",
          "@codemirror/autocomplete",
          "@codemirror/collab",
          "@codemirror/commands",
          "@codemirror/language",
          "@codemirror/lint",
          "@codemirror/search",
          "@codemirror/state",
          "@codemirror/view",
          "@lezer/common",
          "@lezer/highlight",
          "@lezer/lr",
        ],
      },
      outDir: setOutDir(mode),
      emptyOutDir: false,
      minify: isMin,
      sourcemap: isMin ? false : true,
    },
  };
});
