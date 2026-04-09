import nacl from 'tweetnacl';

// Base64 encoding/decoding specifically for Uint8Array
export function encodeBase64(bytes) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export function decodeBase64(base64) {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes;
}

// Generate new WireGuard Keypair
export function generateWireguardKeys() {
  // 1. Generate 32 random bytes for Private Key
  const privateKeyBytes = new Uint8Array(32);
  window.crypto.getRandomValues(privateKeyBytes);
  
  // 2. Generate Public Key from Private Key (nacl internally does Curve25519 scalar multiplication and clamping)
  const publicKeyBytes = nacl.scalarMult.base(privateKeyBytes);

  return {
    privateKey: encodeBase64(privateKeyBytes),
    publicKey: encodeBase64(publicKeyBytes)
  };
}

export function generatePresharedKey() {
  const pskBytes = new Uint8Array(32);
  window.crypto.getRandomValues(pskBytes);
  return encodeBase64(pskBytes);
}

// Calculate public key from existing private key
export function getPublicKeyFromPrivateKey(privateKeyBase64) {
  try {
    const privateKeyBytes = decodeBase64(privateKeyBase64);
    if (privateKeyBytes.length !== 32) throw new Error('Invalid key length');
    const publicKeyBytes = nacl.scalarMult.base(privateKeyBytes);
    return encodeBase64(publicKeyBytes);
  } catch (e) {
    return null;
  }
}
