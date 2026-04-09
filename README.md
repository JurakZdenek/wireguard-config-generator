# WireGuard Config Generator

A fast, modern, and completely secure client-side application for generating WireGuard server and client configurations.

## 🚀 Features

- **100% Client-Side**: No backend required! Everything is generated locally in your browser.
- **Secure Key Generation**: Employs modern cryptographic APIs and `tweetnacl` logic to generate mathematically secure private and public keys.
- **QR Code Support**: Easily scan your generated configuration directly to your mobile device.
- **Bulk Management**: Export all configurations into a single JSON file for backups, or download bulk `.conf` files packed neatly in a ZIP archive.
- **Sleek UI**: Modern "glassmorphism" design, focused on clarity and a premium user experience.
- **I18N**: Available in multiple languages (English and Czech).

## 🔒 Why is it Secure?

When dealing with VPN configurations and private keys, security is absolutely critical. This application guarantees your privacy through the following design choices:

- **No Remote Servers**: Your generated `private keys`, `public keys`, and `preshared keys` **never** leave your device. The entire key-generation and formatting process runs entirely inside your browser's memory.
- **No Tracking**: We do not store, send, or analyze your IP addresses, subnets, or configurations.
- **Offline Capable**: Because it runs wholly in the browser via JavaScript, you can download the repository, turn off your internet connection, and generate your VPN config files entirely offline.
- **Safe Crypto**: Uses the browser's native Web Crypto API (`window.crypto.getRandomValues`) to ensure high-entropy, secure randomness for your Curve25519 keys.

## 🛠️ Built With

- **React.js** (via Vite)
- **Vanilla CSS** with a robust, scalable styling architecture
- [qrcode.react](https://www.npmjs.com/package/qrcode.react) for instant QR visualizations
- [JSZip](https://www.npmjs.com/package/jszip) for seamless bulk archive downloads
- [i18next](https://www.npmjs.com/package/i18next) for localization
- [tweetnacl](https://github.com/dchest/tweetnacl-js) for handling cryptography

## 💻 Local Development

1. Clone the repository:
   ```bash
   git clone <repository-url>
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```

To build the project for production, run:
```bash
npm run build
```
All static files will be exported to the `dist/` folder, ready to be hosted on any static web server (like GitHub Pages, Netlify, Apache, or Nginx).