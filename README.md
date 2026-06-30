# Keep in Touch

A small desktop app for keeping in touch with the people you care about. Every friend is a polaroid pinned to a board. The longer it has been since you talked, the more their photo fades, so the board itself tells you who you are drifting from. Catch up and they come back to full colour.

Everything lives on your own machine. There is no account, no sign in, and nothing leaves your computer. Your friends, photos, and notes are stored in a local file on your device.

## What it does

- A board of friends as polaroids, which you can drag around and resize
- Photos fade the longer it has been since you last talked, so neglect is visible at a glance
- Separate tracking for texts and calls, each with its own "today" button
- A birthday tracker and a plans tracker, gathered into one "coming up" view
- Hover a card to flip it over for the handwritten details
- A gentle reminder on launch of anyone you have not reached in a while

## Download and run (no setup)

Go to the [Releases](../../releases) page and download the file for your system:

- macOS: the `.dmg`
- Windows: the `.exe` installer
- Linux: the `.AppImage`

Open it and you are done. The apps are not code signed yet, so the first time you open it your system may warn about an unidentified developer. On macOS, right click the app and choose Open, then confirm once.

## Run from the source

You need [Node.js](https://nodejs.org) installed. Then:

```bash
git clone https://github.com/YOUR_USERNAME/keep-in-touch.git
cd keep-in-touch
npm install
npm start
```

## Build the installers yourself

```bash
npm run dist
```

This produces an installer for whatever system you run it on, inside a `dist` folder. To build for all three systems at once without owning each machine, push a version tag and let GitHub do it (see below).

## Cutting a release

The repo includes a GitHub Actions workflow that builds the Mac, Windows, and Linux installers and attaches them to a release whenever you push a version tag.

```bash
npm version patch
git push --follow-tags
```

Watch the Actions tab. When it finishes, the installers appear on the Releases page.

## A note on fonts

The handwritten look uses a font dropped into the `fonts` folder. See `fonts/README.txt` for which file to add. Without it the app falls back to a system font and still works.

## License

MIT. See [LICENSE](LICENSE).
