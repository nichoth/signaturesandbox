import { html } from 'htm/preact'
import { FunctionComponent } from 'preact'
import { signal } from '@preact/signals'
import { verify as rsaVerify, RsaKeys } from '@substrate-system/keys/rsa'

type Encoding = 'base64' | 'base58' | 'base64url' | 'hex'

// Generator state
const genKeys = signal<RsaKeys | null>(null)
const genMessage = signal('')
const genSignature = signal('')
const genSignatureBytes = signal<Uint8Array | null>(null)
const genPublicKey = signal('')
const genDid = signal('')
const genEncoding = signal<Encoding>('base64')
const genSigEncoding = signal<Encoding>('base64')

// Verifier state
const verMessage = signal('')
const verSignature = signal('')
const verPublicKey = signal('')
const verEncoding = signal<Encoding>('base64')
const verResult = signal<{ valid: boolean, error?: string } | null>(null)

export const RSARoute:FunctionComponent = function RSARoute () {
    async function generateKeys () {
        try {
            const keys = await RsaKeys.create(true, true)
            genKeys.value = keys

            const json = await keys.toJson('base64')
            genDid.value = json.DID

            await updatePublicKeyEncoding()
        } catch (error) {
            console.error('Failed to generate keys:', error)
        }
    }

    async function updatePublicKeyEncoding () {
        if (!genKeys.value) return

        try {
            if (genEncoding.value === 'base58' || genEncoding.value === 'hex') {
                const base64Key = await genKeys.value.publicWriteKey.asString('base64')
                const bytes = base64ToBytes(base64Key)
                const encoded = await encodeBytes(bytes, genEncoding.value)
                genPublicKey.value = encoded
            } else {
                const publicKeyString = await genKeys.value.publicWriteKey.asString(genEncoding.value)
                genPublicKey.value = publicKeyString
            }
        } catch (error) {
            console.error('Failed to convert public key:', error)
        }
    }

    async function signMessage () {
        if (!genKeys.value || !genMessage.value) return

        try {
            const sigBytes = await genKeys.value.sign(genMessage.value)
            genSignatureBytes.value = sigBytes

            // Convert signature to selected encoding
            await updateSignatureEncoding()
        } catch (error) {
            console.error('Failed to sign message:', error)
        }
    }

    async function updateSignatureEncoding () {
        if (!genSignatureBytes.value) return

        try {
            const encoded = await encodeBytes(genSignatureBytes.value, genSigEncoding.value)
            genSignature.value = encoded
        } catch (error) {
            console.error('Failed to convert signature:', error)
        }
    }

    async function handleVerify (ev:Event) {
        ev.preventDefault()
        verResult.value = null

        try {
            const msgStr = verMessage.value

            // Convert signature to base64url for verification
            const sigBytes = decodeFromEncoding(verSignature.value, verEncoding.value)
            const sigBase64url = bytesToBase64Url(sigBytes)

            // Public key needs to be in DID format
            let didKey: string
            if (verPublicKey.value.startsWith('did:key:')) {
                didKey = verPublicKey.value
            } else {
                const pubKeyBytes = decodeFromEncoding(verPublicKey.value, verEncoding.value)
                didKey = `did:key:z${bytesToBase58(pubKeyBytes)}`
            }

            const isValid = await rsaVerify(msgStr, sigBase64url, didKey as `did:key:z${string}`)
            verResult.value = { valid: isValid }
        } catch (error) {
            verResult.value = { valid: false, error: (error as Error).message }
        }
    }

    async function encodeBytes (bytes:Uint8Array, enc:Encoding):Promise<string> {
        switch (enc) {
            case 'base64':
                return bytesToBase64(bytes)
            case 'base58':
                return bytesToBase58(bytes)
            case 'base64url':
                return bytesToBase64Url(bytes)
            case 'hex':
                return bytesToHex(bytes)
            default:
                throw new Error('Unsupported encoding')
        }
    }

    function decodeFromEncoding (str:string, enc:Encoding):Uint8Array {
        switch (enc) {
            case 'base64':
                return base64ToBytes(str)
            case 'base58':
                return base58ToBytes(str)
            case 'base64url':
                return base64UrlToBytes(str)
            case 'hex':
                return hexToBytes(str)
            default:
                throw new Error('Unsupported encoding')
        }
    }

    function base64ToBytes (str:string):Uint8Array {
        const binaryString = atob(str)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i)
        }
        return bytes
    }

    function bytesToBase64 (bytes:Uint8Array):string {
        return btoa(String.fromCharCode(...bytes))
    }

    function base64UrlToBytes (str:string):Uint8Array {
        let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
        while (base64.length % 4) {
            base64 += '='
        }
        return base64ToBytes(base64)
    }

    function hexToBytes (str:string):Uint8Array {
        const hex = str.replace(/^0x/, '')
        const bytes = new Uint8Array(hex.length / 2)
        for (let i = 0; i < hex.length; i += 2) {
            bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
        }
        return bytes
    }

    function bytesToHex (bytes:Uint8Array):string {
        return Array.from(bytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')
    }

    function bytesToBase64Url (bytes:Uint8Array):string {
        const base64 = btoa(String.fromCharCode(...bytes))
        return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
    }

    function bytesToBase58 (bytes:Uint8Array):string {
        const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
        const BASE = 58

        let num = BigInt(0)
        for (let i = 0; i < bytes.length; i++) {
            num = num * BigInt(256) + BigInt(bytes[i])
        }

        let result = ''
        while (num > 0) {
            const remainder = Number(num % BigInt(BASE))
            result = ALPHABET[remainder] + result
            num = num / BigInt(BASE)
        }

        for (let i = 0; i < bytes.length && bytes[i] === 0; i++) {
            result = ALPHABET[0] + result
        }

        return result
    }

    function base58ToBytes (str:string):Uint8Array {
        const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
        const BASE = 58

        let result = BigInt(0)
        for (let i = 0; i < str.length; i++) {
            const digit = ALPHABET.indexOf(str[i])
            if (digit < 0) throw new Error('Invalid base58 character')
            result = result * BigInt(BASE) + BigInt(digit)
        }

        const hex = result.toString(16)
        const paddedHex = hex.length % 2 ? '0' + hex : hex
        return hexToBytes(paddedHex)
    }

    return html`<div class="route rsa-route">
        <h1>RSA Signature</h1>
        <a href="/">← Back to home</a>

        <div class="two-column-layout">
            <div class="col-half">
                <h2>Generator</h2>

                <button class="action-button" onClick=${generateKeys}>
                    Generate RSA Keypair
                </button>

                ${genKeys.value && html`
                    <div class="key-display">
                        <h4>DID:</h4>
                        <div class="output-field">
                            <div class="output-content">${genDid.value}</div>
                            <copy-button payload=${genDid.value || 'placeholder'}>
                            </copy-button>
                        </div>
                    </div>

                    <div class="form-group">
                        <label>Public Key Encoding:</label>
                        <div class="radio-group">
                            <label class="radio-label">
                                <input
                                    type="radio"
                                    name="gen-encoding"
                                    value="base64"
                                    checked=${genEncoding.value === 'base64'}
                                    onChange=${async () => {
                                        genEncoding.value = 'base64'
                                        await updatePublicKeyEncoding()
                                    }}
                                />
                                Base64
                            </label>
                            <label class="radio-label">
                                <input
                                    type="radio"
                                    name="gen-encoding"
                                    value="base64url"
                                    checked=${genEncoding.value === 'base64url'}
                                    onChange=${async () => {
                                        genEncoding.value = 'base64url'
                                        await updatePublicKeyEncoding()
                                    }}
                                />
                                Base64URL
                            </label>
                            <label class="radio-label">
                                <input
                                    type="radio"
                                    name="gen-encoding"
                                    value="base58"
                                    checked=${genEncoding.value === 'base58'}
                                    onChange=${async () => {
                                        genEncoding.value = 'base58'
                                        await updatePublicKeyEncoding()
                                    }}
                                />
                                Base58
                            </label>
                        </div>
                    </div>

                    <div class="key-display">
                        <label>Public Key (${genEncoding.value}):</label>
                        <div class="output-field">
                            <div class="output-content">${genPublicKey.value}</div>
                            <copy-button payload=${genPublicKey.value || 'placeholder'}></copy-button>
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="gen-message">Message to Sign:</label>
                        <textarea
                            id="gen-message"
                            value=${genMessage.value}
                            onInput=${(e:any) => { genMessage.value = e.target.value }}
                            placeholder="Enter message to sign"
                            rows="4"
                        />
                    </div>

                    <button
                        class="action-button"
                        onClick=${signMessage}
                        disabled=${!genMessage.value}
                    >
                        Sign Message
                    </button>

                    ${genSignature.value && html`
                        <div class="form-group">
                            <label>Signature Encoding:</label>
                            <div class="radio-group">
                                <label class="radio-label">
                                    <input
                                        type="radio"
                                        name="gen-sig-encoding"
                                        value="base64"
                                        checked=${genSigEncoding.value === 'base64'}
                                        onChange=${async () => {
                                            genSigEncoding.value = 'base64'
                                            await updateSignatureEncoding()
                                        }}
                                    />
                                    Base64
                                </label>
                                <label class="radio-label">
                                    <input
                                        type="radio"
                                        name="gen-sig-encoding"
                                        value="base64url"
                                        checked=${genSigEncoding.value === 'base64url'}
                                        onChange=${async () => {
                                            genSigEncoding.value = 'base64url'
                                            await updateSignatureEncoding()
                                        }}
                                    />
                                    Base64URL
                                </label>
                                <label class="radio-label">
                                    <input
                                        type="radio"
                                        name="gen-sig-encoding"
                                        value="base58"
                                        checked=${genSigEncoding.value === 'base58'}
                                        onChange=${async () => {
                                            genSigEncoding.value = 'base58'
                                            await updateSignatureEncoding()
                                        }}
                                    />
                                    Base58
                                </label>
                            </div>
                        </div>

                        <div class="key-display">
                            <label>Signature (${genSigEncoding.value}):</label>
                            <div class="output-field">
                                <div class="output-content">${genSignature.value}</div>
                                <copy-button payload=${genSignature.value || 'placeholder'}></copy-button>
                            </div>
                        </div>
                    `}
                `}
            </div>

            <div class="col-half">
                <h2>Verifier</h2>

                <form onSubmit=${handleVerify} class="verification-form">
                    <div class="form-group">
                        <label for="ver-message">Message:</label>
                        <textarea
                            id="ver-message"
                            value=${verMessage.value}
                            onInput=${(e:any) => { verMessage.value = e.target.value }}
                            placeholder="Enter the message that was signed"
                            rows="4"
                        />
                    </div>

                    <div class="form-group">
                        <label for="ver-encoding">Encoding:</label>
                        <select
                            id="ver-encoding"
                            value=${verEncoding.value}
                            onChange=${(e:any) => { verEncoding.value = e.target.value as Encoding }}
                        >
                            <option value="base64">Base64</option>
                            <option value="base58">Base58</option>
                            <option value="base64url">Base64URL</option>
                            <option value="hex">Hex</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label for="ver-signature">Signature (${verEncoding.value}):</label>
                        <textarea
                            id="ver-signature"
                            value=${verSignature.value}
                            onInput=${(e:any) => { verSignature.value = e.target.value }}
                            placeholder="Enter the signature"
                            rows="3"
                        />
                    </div>

                    <div class="form-group">
                        <label for="ver-publicKey">Public Key or DID (${verEncoding.value}):</label>
                        <textarea
                            id="ver-publicKey"
                            value=${verPublicKey.value}
                            onInput=${(e:any) => { verPublicKey.value = e.target.value }}
                            placeholder="Enter the public key or DID"
                            rows="3"
                        />
                    </div>

                    <button type="submit" class="verify-button">Verify Signature</button>
                </form>

                ${verResult.value && html`
                    <div class="result ${verResult.value.valid ? 'valid' : 'invalid'}">
                        <h3>${verResult.value.valid ? '✓ Valid Signature' : '✗ Invalid Signature'}</h3>
                        ${verResult.value.error && html`<p class="error">Error: ${verResult.value.error}</p>`}
                    </div>
                `}
            </div>
        </div>
    </div>`
}
