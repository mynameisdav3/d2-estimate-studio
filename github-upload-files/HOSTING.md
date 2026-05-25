# Hosting The Estimate Studio

The estimator cannot be permanently accessed from `localhost`. `localhost` always means "this device," so your iPad cannot use your Mac's `localhost` link unless you set up temporary local-network sharing.

The simplest reliable setup is:

1. Host this folder as a small static app.
2. Put a hidden page or button on `thealchemyist.com` that links to the hosted estimator.
3. Open that hosted link on Mac, iPad, or phone.
4. Add it to the iPad/iPhone Home Screen so it behaves like an app.

## Recommended Option: GitHub Pages

GitHub Pages is a good long-term fit because it can host this static estimator and keep a version history of every change.

1. Create a GitHub account or sign in at `https://github.com`.
2. Create a new repository, for example `d2-estimate-studio`.
3. Add these files to the repository.
4. Open the repository `Settings`.
5. Go to `Pages`.
6. Under `Build and deployment`, choose:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
7. GitHub will publish a live URL, usually like:
   `https://your-github-name.github.io/d2-estimate-studio/`
8. In Wix, create a hidden page or redirect that points to that GitHub Pages URL.

No build command is needed. This app is plain HTML, CSS, and JavaScript.

## Alternative Option: Netlify

This is the easiest way to host the current files without rebuilding your Wix site.

1. Go to `https://app.netlify.com/drop`.
2. Drag in `alchemyist-estimate-studio.zip`.
3. Netlify gives you a live HTTPS URL.
4. Rename the site to something memorable, for example `alchemyist-estimates`.
5. The live app will be available at a URL like:
   `https://alchemyist-estimates.netlify.app`
6. In Wix, create a hidden page or hidden button that links to that Netlify URL.

This keeps your main Wix site as-is while giving the estimator its own stable link.

If Netlify asks for a deploy folder instead of a zip, drag in this whole project folder:
`/Users/d2/Documents/Codex/2026-05-24/i-need-to-create-a-simple`

No build command is needed. The publish directory is the root folder.

## Wix Piggyback Setup

In Wix:

1. Create a hidden page called `Estimate Studio`.
2. Set the page URL to something private, for example:
   `https://www.thealchemyist.com/estimate-studio`
3. Hide the page from the menu.
4. Add a button or text link on that hidden page:
   `Open Estimate Studio`
5. Link that button to your hosted estimator URL.

This gives you a familiar URL on your Wix domain, even though the app itself is hosted separately.

Recommended hidden URL:
`https://www.thealchemyist.com/estimate-studio`

## iPad / iPhone App-Like Access

Once the estimator has an HTTPS URL:

1. Open the URL in Safari.
2. Tap Share.
3. Tap Add to Home Screen.
4. Name it `Estimates`.

After that it opens like a normal app icon.

## Updating Later

When you ask Codex to make changes, keep using this project folder. After changes are made:

1. Create a new deployment zip.
2. Upload it to the same Netlify site.
3. The live URL stays the same.
