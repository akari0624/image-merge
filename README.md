# Image Merge Tool

A browser-based tool for uploading multiple images (and PDFs), reordering them via drag & drop, and merging them into a single vertically-stacked image or PDF.

Built with React + TypeScript + Vite + Tailwind CSS v4. This project was bootstrapped from the [Vite `react-ts` template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts).

## Development

```bash
pnpm install
pnpm dev
```

## Build

```bash
pnpm build
```

## CI/CD: GitHub Pages Deployment

This project uses **GitHub Actions** to deploy to GitHub Pages — no `gh-pages` branch or third-party deploy packages needed.

### How it works

1. **Vite `base` path** (`vite.config.ts`): When running in GitHub Actions, `base` is automatically set to `'/image-merge/'` (the repo name) so asset paths resolve correctly under `https://<user>.github.io/image-merge/`. Local dev remains `/`.

2. **GitHub Actions workflow** (`.github/workflows/deploy.yml`): On every push to `master`, the workflow runs `pnpm build`, uploads the `dist/` folder as a Pages artifact, and deploys it directly — no intermediate branch involved.

### Why not `gh-pages` package?

The `gh-pages` npm package works by force-pushing build output to a `gh-pages` branch. This was the standard approach before GitHub introduced the `actions/deploy-pages` action in 2022.

The newer approach (used here) deploys directly from workflow artifacts, which:

- Avoids polluting the repo with a force-pushed deploy branch
- Requires only `pages: write` permission (no repo write access)
- Provides atomic deployments from build artifacts

### Setup steps

1. Create a GitHub repo named `image-merge`
2. Add the remote and push:
   ```bash
   git remote add origin git@github.com:<your-username>/image-merge.git
   git push -u origin master
   ```
3. Go to repo **Settings > Pages > Source** and select **GitHub Actions**
4. The workflow will run automatically on push. Once complete, the site is live at:
   ```
   https://<your-username>.github.io/image-merge/
   ```
