# BiTTY - Bitwarden TUI

## Install

```bash
npm install -g bitty-tui
```

Run with:

```bash
bitty
```

## Description

Bitwarden compatible TUI for your terminal.

![bw-dashboard](./media/screen1.png)
![bw-dashboard](./media/screen2.png)

Works also with Vaultwarden.

If you check "Remember me" during login, your vault encryption keys will be stored in plain text in your home folder (`$HOME/.config/bitty/config.json`). Use this option only if you are the only user of your machine.

## Custom keybindings

Click the **⚙** button in the toolbar, or press `Ctrl+K`, to open the keybindings editor. Use `↑`/`↓` to select an action, `Enter` to capture a new key combination, and `Esc` to close.

Overrides are saved to `~/.config/bitty/keybinds.json` and merged with the defaults on startup. Delete the file (or use "Reset to defaults" inside the editor) to go back to the defaults.


## Acknowledgments
- [Bitwarden whitepaper](https://bitwarden.com/help/bitwarden-security-white-paper)
- [Bitwarden github](https://github.com/bitwarden)
- [BitwardenDecrypt](https://github.com/GurpreetKang/BitwardenDecrypt)

This project is not associated with [Bitwarden](https://github.com/bitwarden) or [Bitwarden, Inc.](https://bitwarden.com/)
