# PMX Pal

[English](README.md) | [日本語](README.ja.md)

PMX Pal is a transparent desktop mascot app that displays PMX models on macOS.

## Features

- Load PMX models and textures referenced with relative paths
- Display models in a transparent, always-on-top window
- Switch between camera pan, rotate, and fixed interaction modes
- Pan, rotate, and zoom the camera to adjust the model view
- Load multiple VMD motions and switch idle animations approximately every 12 seconds
- Simulate hair, clothing, and accessories with MMD-oriented Bullet Physics
- Switch between no gaze control, camera gaze, and mouse cursor tracking
- Track the mouse cursor even when it is outside the app window
- Restore the window position and size, selected PMX and VMD files, interaction mode, and gaze mode
- Save camera position, rotation, and zoom separately for each model
- Handle file paths containing Japanese characters and spaces

## Development

Requirements:

- macOS
- Node.js 26 (stable)
- npm 11

```sh
npm ci
npm run dev
```

Run the tests, type checks, and production build:

```sh
npm test
npm run check
npm run build
```

GitHub Actions runs the same tests, type checks, and build.

Create a macOS ZIP archive:

```sh
npm run dist:mac
```

Create a DMG:

```sh
npm run dist:dmg
```

## Controls

- Drag the top bar to move the window.
- Drag the `✥` handle while the toolbar is visible to move the window.
- The toolbar hides after three seconds of inactivity and reappears when the pointer moves.
- Move the pointer to the top edge of the window to reveal a hidden toolbar.
- Use the PMX Pal menu in the macOS menu bar to select PMX and VMD files, change interaction and gaze modes, toggle idle motion and always-on-top behavior, or quit the app.
- Use the interaction-mode button to select camera pan, rotation, or fixed mode.
- In pan mode, drag to move the camera vertically or horizontally.
- In rotation mode, drag to rotate the camera.
- In fixed mode, camera pan, rotation, and zoom are disabled.
- In pan or rotation mode, scroll or pinch on a trackpad to zoom.
- Use the motion button to select one or more idle VMD motions.
- Use the idle button to enable or disable the selected idle motions.
- Use the physics button to enable or disable MMD physics.
- Use the gaze-mode button to select no gaze control, camera gaze, or cursor tracking.
- Camera gaze turns the character's eyes, head, and neck toward the camera.
- Cursor tracking follows the mouse pointer, including outside the app window.
- Right-click or press `M` to open the menu.
- Drag the striped handle in the bottom-right corner to resize the window.
- Use the always-on-top button to toggle whether the window stays above other windows.

## Possible Future Improvements

- Click reactions and expression changes
- Automatic blinking and other expressions
- Click-through behavior outside the visible character
- Menu bar integration and multiple-model management

Check the license terms for each model, texture, and motion before using or redistributing it.

See [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) for licenses covering the libraries and physics binaries used by PMX Pal.
