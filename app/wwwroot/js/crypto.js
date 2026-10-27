// OTP versleuteling met modulo 37
// Alfabet: A-Z (0-25), 0-9 (26-35), _ (36, staat voor spatie)

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_';
const MOD = ALPHABET.length; // 37

// Zet een teken om naar een nummer (A=0, B=1, ..., _=36)
function charToNum(c) {
    const i = ALPHABET.indexOf(c);
    if (i === -1) throw new Error(`Ongeldig teken: '${c}'`);
    return i;
}

// Zet een nummer om naar een teken
function numToChar(n) {
    return ALPHABET[((n % MOD) + MOD) % MOD];
}

// Bereid een bericht voor: hoofdletters, spatie wordt _, andere tekens weg
export function prepareText(text) {
    return text
        .toUpperCase()
        .replace(/ /g, '_')
        .replace(/[^A-Z0-9_]/g, '');
}

// Versleutel: (bericht + sleutel) mod 37 per teken
export function encrypt(plaintext, key) {
    const prepared = prepareText(plaintext);
    if (key.length < prepared.length) {
        throw new Error(
            `Sleutel te kort: bericht is ${prepared.length} tekens, sleutel is ${key.length} tekens`
        );
    }
    let ciphertext = '';
    for (let i = 0; i < prepared.length; i++) {
        const p = charToNum(prepared[i]);
        const k = charToNum(key[i]);
        ciphertext += numToChar(p + k);
    }
    return ciphertext;
}

// Bereken HMAC-SHA256 over de ciphertext met een aparte sleutel
// Geeft een hex-string terug
export async function computeHmac(ciphertext, hmacKey) {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(hmacKey);
    const msgData = encoder.encode(ciphertext);

    const cryptoKey = await crypto.subtle.importKey(
        'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
    return Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

// Verifieer HMAC-SHA256: geeft true als de MAC klopt
export async function verifyHmac(ciphertext, hmacKey, expectedMac) {
    const computed = await computeHmac(ciphertext, hmacKey);
    return computed === expectedMac;
}

// Ontcijfer: (ciphertext - sleutel) mod 37 per teken
export function decrypt(ciphertext, key) {
    if (key.length < ciphertext.length) {
        throw new Error(
            `Sleutel te kort: ciphertext is ${ciphertext.length} tekens, sleutel is ${key.length} tekens`
        );
    }
    let plaintext = '';
    for (let i = 0; i < ciphertext.length; i++) {
        const c = charToNum(ciphertext[i]);
        const k = charToNum(key[i]);
        plaintext += numToChar(c - k);
    }
    return plaintext.replace(/_/g, ' ');
}

