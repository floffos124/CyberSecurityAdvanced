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

