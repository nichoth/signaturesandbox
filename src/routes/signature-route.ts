import { html } from 'htm/preact'
import { FunctionComponent } from 'preact'
import { useCallback } from 'preact/hooks'
import { type DID } from '@substrate-system/keys'
import { verify, publicKeyToDid } from '@substrate-system/keys/crypto'
import * as u8 from 'uint8arrays'
import { type SupportedEncodings } from 'uint8arrays'
import Debug from '@substrate-system/debug'
import { useComputed, useSignal } from '@preact/signals'
import { EccKeys } from '@substrate-system/keys/ecc'
import { RsaKeys } from '@substrate-system/keys/rsa'
import '@substrate-system/copy-button'
import { State, type Uint8Encodings } from '../state.js'
import { isDev } from '../util.js'
import {
    toBase64Pad,
    toBase64Url,
    toBase58Btc,
    toBase16
} from '@atcute/multibase'
import { decode as decodeMultikey } from '@substrate-system/multikey'
import * as ed from '@noble/ed25519'

const debug = Debug(isDev())
const { toString, fromString } = u8

type KeyType = 'ecc'|'rsa'

// @ts-expect-error dev
window.verify = verify
// @ts-expect-error dev
window.u8 = u8

export const SignatureRoute:FunctionComponent<{
    state:ReturnType<typeof State>;
    keyType:KeyType;
    title:string;
}> = function SignatureRoute ({ state, keyType, title }) {
    const encodedValue = useComputed<string>(() => {
        const baseEncoded = state.encodedPublicKeys.value?.[state.encodings.publicKey.value] || ''

        // Multikey format already includes the 'z' prefix, so return as-is
        if (state.encodings.publicKey.value === 'multikey') {
            return baseEncoded
        }

        if (!state.encodings.useMultibase.value || !baseEncoded) {
            return baseEncoded
        }

        // Convert to multibase encoding with prefix
        const bytes = fromString(baseEncoded, state.encodings.publicKey.value)

        switch (state.encodings.publicKey.value) {
            case 'base64pad':
                return 'M' + toBase64Pad(bytes)
            case 'base64url':
                return 'U' + toBase64Url(bytes)
            case 'base58btc':
                return 'z' + toBase58Btc(bytes)
            case 'hex':
                return 'f' + toBase16(bytes)
            default:
                return baseEncoded
        }
    })

    const encodedPrivateKeyValue = useComputed<string>(() => {
        const baseEncoded = state.encodedPrivateKeys.value?.[state.encodings.publicKey.value] || ''

        // Multikey format already includes the 'z' prefix, so return as-is
        if (state.encodings.publicKey.value === 'multikey') {
            return baseEncoded
        }

        if (!state.encodings.useMultibase.value || !baseEncoded) {
            return baseEncoded
        }

        // Convert to multibase encoding with prefix
        const bytes = fromString(baseEncoded, state.encodings.publicKey.value)

        switch (state.encodings.publicKey.value) {
            case 'base64pad':
                return 'M' + toBase64Pad(bytes)
            case 'base64url':
                return 'U' + toBase64Url(bytes)
            case 'base58btc':
                return 'z' + toBase58Btc(bytes)
            case 'hex':
                return 'f' + toBase16(bytes)
            default:
                return baseEncoded
        }
    })

    const showImportForm = useSignal<boolean>(false)
    const importPrivateKey = useSignal<string>('')
    const importFormat = useSignal<'jwk'|'pem'|'raw'>('jwk')

    const importKey = useCallback((ev:MouseEvent) => {
        ev.preventDefault()
        showImportForm.value = !showImportForm.value
    }, [])

    const sigString = useComputed<string|null>(() => {
        if (!state.generator.signatureBytes.value) return null

        const baseEncoded = toString(
            state.generator.signatureBytes.value,
            state.encodings.signature.value
        )

        if (!state.encodings.useMultibase.value) {
            return baseEncoded
        }

        // Convert to multibase encoding with prefix
        const bytes = state.generator.signatureBytes.value

        switch (state.encodings.signature.value) {
            case 'base64pad':
                return 'M' + toBase64Pad(bytes)
            case 'base64url':
                return 'U' + toBase64Url(bytes)
            case 'base58btc':
                return 'z' + toBase58Btc(bytes)
            case 'hex':
                return 'f' + toBase16(bytes)
            default:
                return baseEncoded
        }
    })

    const generateKeys = useCallback(async () => {
        if (keyType === 'ecc') {
            await State.generateEcc(state)
        } else {
            await State.generateRsa(state)
        }
    }, [state, keyType])

    const signMessage = useCallback(async (ev:SubmitEvent) => {
        ev.preventDefault()
        const form = ev.target as HTMLFormElement
        const text = form.elements['message'].value

        const keys = (keyType === 'ecc' ?
            state.eccKeys.value :
            state.rsaKeys.value)
        if (!keys) return

        try {
            const sigBytes = await keys.sign(text)
            state.generator.signatureBytes.value = sigBytes
        } catch (error) {
            console.error('Failed to sign message:', error)
        }
    }, [keyType, state])

    const handlePublicKeyEncodingChange = useCallback((ev:Event) => {
        const target = ev.target as HTMLInputElement
        if (target.type === 'radio' && target.checked) {
            debug('target value...', target.value)
            State.setPublicKeyEncoding(state, target.value as Uint8Encodings)
        }
    }, [state])

    const handleMultibaseChange = useCallback((ev:Event) => {
        const target = ev.target as HTMLInputElement
        state.encodings.useMultibase.value = target.checked
    }, [state])

    const handleSignatureEncodingChange = useCallback((ev:Event) => {
        const target = ev.target as HTMLInputElement
        if (target.type === 'radio' && target.checked) {
            State.setSignatureEncoding(state, target.value as SupportedEncodings)
        }
    }, [state])

    const handleVerifierSignatureEncodingChange = useCallback((ev:Event) => {
        const target = ev.target as HTMLInputElement
        State.setVerifierSignatureEncoding(state, target.value as SupportedEncodings)
    }, [state])

    const handleVerifierPublicKeyEncodingChange = useCallback((ev:Event) => {
        const target = ev.target as HTMLInputElement
        State.setVerifierPublicKeyEncoding(state, target.value as Uint8Encodings)
    }, [state])

    const handleImportFormatChange = useCallback((ev:Event) => {
        const target = ev.target as HTMLInputElement
        if (target.type === 'radio' && target.checked) {
            importFormat.value = target.value as 'jwk'|'pem'|'raw'
        }
    }, [])

    const handleImportPrivateKey = useCallback(async (ev:SubmitEvent) => {
        ev.preventDefault()
        const form = ev.target as HTMLFormElement
        const privateKeyStr = form.elements['privateKey'].value.trim()

        try {
            // Import based on key type
            if (keyType === 'ecc') {
                // For Ed25519, support both raw and JWK formats
                let privateKey:CryptoKey

                if (importFormat.value === 'raw') {
                    // Raw format: just the 32-byte private key seed as base64url
                    const seedBytes = fromString(
                        privateKeyStr,
                        'base64url'
                    ) as Uint8Array<ArrayBuffer>

                    if (seedBytes.length !== 32) {
                        throw new Error('Invalid Ed25519 raw private key: must be 32 bytes')
                    }

                    // Derive the public key from the private seed using @noble/ed25519
                    const publicKeyBytes = await ed.getPublicKeyAsync(seedBytes)

                    // Convert both to base64url for JWK format
                    const publicKeyBase64url = toString(publicKeyBytes, 'base64url')

                    // Create JWK with both private and public keys
                    const jwk = {
                        kty: 'OKP',
                        crv: 'Ed25519',
                        d: privateKeyStr,  // Private key (already base64url)
                        x: publicKeyBase64url,  // Public key (base64url)
                        ext: true
                    }

                    privateKey = await crypto.subtle.importKey(
                        'jwk',
                        jwk,
                        { name: 'Ed25519' },
                        true,
                        ['sign']
                    )
                } else {
                    // JWK format
                    const jwk = JSON.parse(privateKeyStr)

                    if (jwk.kty !== 'OKP' || jwk.crv !== 'Ed25519') {
                        throw new Error('Invalid Ed25519 JWK: must have kty="OKP" and crv="Ed25519"')
                    }

                    privateKey = await crypto.subtle.importKey(
                        'jwk',
                        jwk,
                        { name: 'Ed25519' },
                        true,
                        ['sign']
                    )
                }

                // Derive the public key
                const exportedJwk = await crypto.subtle.exportKey('jwk', privateKey)
                if (!exportedJwk.x) throw new Error('Failed to export public key')

                // JWK x parameter is always base64url encoded
                const publicKeyBytes = fromString(
                    exportedJwk.x,
                    'base64url'
                ) as Uint8Array<ArrayBuffer>

                // Create keypair
                const keypair = {
                    privateKey,
                    publicKey: await crypto.subtle.importKey(
                        'raw',
                        publicKeyBytes,
                        { name: 'Ed25519' },
                        true,
                        ['verify']
                    )
                }

                const keys = await EccKeys.create(true, true, { writeKeys: keypair })
                const json = await keys.toJson('base64')

                state.eccKeys.value = keys
                state.did.value = json.DID
            } else {
                // For RSA, support both PEM and JWK formats
                let privateKey:CryptoKey

                if (importFormat.value === 'jwk') {
                    // Parse JWK
                    const jwk = JSON.parse(privateKeyStr)

                    if (jwk.kty !== 'RSA') {
                        throw new Error('Invalid RSA JWK: must have kty="RSA"')
                    }

                    privateKey = await crypto.subtle.importKey(
                        'jwk',
                        jwk,
                        {
                            name: 'RSA-PSS',
                            hash: 'SHA-256'
                        },
                        true,
                        ['sign']
                    )
                } else {
                    // Parse PEM format
                    // Remove PEM headers and decode base64
                    const pemHeader = '-----BEGIN PRIVATE KEY-----'
                    const pemFooter = '-----END PRIVATE KEY-----'
                    const pemContents = privateKeyStr
                        .replace(pemHeader, '')
                        .replace(pemFooter, '')
                        .replace(/\s/g, '')

                    const binaryDer = fromString(
                        pemContents,
                        'base64pad'
                    ) as Uint8Array<ArrayBuffer>

                    privateKey = await crypto.subtle.importKey(
                        'pkcs8',
                        binaryDer,
                        {
                            name: 'RSA-PSS',
                            hash: 'SHA-256'
                        },
                        true,
                        ['sign']
                    )
                }

                // Export public key
                const jwk = await crypto.subtle.exportKey('jwk', privateKey)
                const publicJwk = {
                    kty: jwk.kty,
                    n: jwk.n,
                    e: jwk.e,
                    alg: jwk.alg,
                    ext: true
                }

                const publicKey = await crypto.subtle.importKey(
                    'jwk',
                    publicJwk,
                    {
                        name: 'RSA-PSS',
                        hash: 'SHA-256'
                    },
                    true,
                    ['verify']
                )

                const keypair = { privateKey, publicKey }

                const keys = await RsaKeys.create(true, true, {
                    writeKeys: keypair
                })

                state.rsaKeys.value = keys
            }

            // Hide the import form after successful import
            showImportForm.value = false
            importPrivateKey.value = ''
        } catch (error) {
            console.error('Failed to import private key:', error)
            alert(`Failed to import private key: ${(error as Error).message}`)
        }
    }, [keyType])

    const handleVerify = useCallback(async (ev:SubmitEvent) => {
        ev.preventDefault()
        state.verifier.result.value = null
        const form = ev.target as HTMLFormElement
        const els = form.elements
        const msg = (els['ver-message'] as HTMLTextAreaElement).value
        debug('the message', msg)

        try {
            const sigStr = state.verifier.signature.value.trim()

            debug('Verifying signature:', {
                message: msg,
                signature: sigStr,
                signatureEncoding: state.verifier.signatureEncoding.value,
                publicKeyEncoding: state.verifier.publicKeyEncoding.value
            })

            // Convert signature to bytes using the selected encoding
            const sigBytes = fromString(sigStr, state.verifier.signatureEncoding.value)

            let did:DID
            const publicKeyValue = state.verifier.publicKey.value.trim()
            if (publicKeyValue.startsWith('did:key:')) {
                did = publicKeyValue as DID
            } else {
                let pubKeyBytes:Uint8Array

                // Check if this is multikey format
                if (state.verifier.publicKeyEncoding.value === 'multikey') {
                    // Decode multikey format
                    const decoded = decodeMultikey(publicKeyValue)
                    pubKeyBytes = decoded.key
                } else {
                    // Use the selected encoding directly
                    pubKeyBytes = fromString(publicKeyValue, state.verifier.publicKeyEncoding.value)
                }

                // Specify 'ed25519' as the key type
                // (defaults to 'rsa' otherwise)
                did = await publicKeyToDid(
                    pubKeyBytes,
                    keyType === 'ecc' ? 'ed25519' : 'rsa'
                )
            }

            const isValid = await verify({
                message: msg,
                did,
                signature: sigBytes
            })
            state.verifier.result.value = { valid: isValid }
        } catch (_err) {
            const err = _err as Error
            console.error('Verification error:', err)
            state.verifier.result.value = {
                valid: false,
                error: (err as Error).message
            }
        }
    }, [])

    const hasKeys = keyType === 'ecc' ? state.eccKeys.value : state.rsaKeys.value

    return html`<div class="route ${keyType}-route">
        <h1>${title}</h1>

        <p>
            Application state is at <code>window.state</code>.
        </p>

        <nav>
            <ul>
                <li><a href="/">${'<'} Back to home</a></li>
            </ul>
        </nav>

        <div class="multibase-control">
            <label class="checkbox-label">
                <input
                    type="checkbox"
                    id="multibase-checkbox"
                    checked=${state.encodings.useMultibase.value}
                    onChange=${handleMultibaseChange}
                    aria-describedby="multibase-description"
                />
                Multibase
            </label>
            <p
                id="multibase-description"
                class="checkbox-description"
            >
                When enabled, adds a multibase prefix to all encoded strings.
                Multibase is a self-describing encoding format that includes a
                prefix character indicating which encoding is used
                (e.g., 'M' for base64pad, 'U' for base64url,
                'z' for base58btc, 'f' for hex).
            </p>
        </div>

        <div class="two-column-layout">
            <div class="col-half keys">
                <h2>Keys</h2>

                ${showImportForm.value ?
                    null :
                    html`<button class="action-button" onClick=${generateKeys}>
                        Generate ${keyType === 'ecc' ? 'Ed25519' : 'RSA'} Keypair
                    </button>`
                }

                <button
                    class="action-button"
                    onClick=${importKey}
                >
                    ${showImportForm.value ? 'Cancel Import' : 'Import Private Key'}
                </button>

                ${showImportForm.value && html`
                    <form class="form-group" onSubmit=${handleImportPrivateKey}>
                        <div class="form-group">
                            <label>Private Key Format:</label>
                            <div
                                class="radio-group"
                                onChange=${handleImportFormatChange}
                            >
                                ${keyType === 'ecc' ? html`
                                    <label class="radio-label">
                                        <input
                                            type="radio"
                                            name="import-format"
                                            value="raw"
                                            checked=${importFormat.value === 'raw'}
                                        />
                                        Raw
                                    </label>
                                    <label class="radio-label">
                                        <input
                                            type="radio"
                                            name="import-format"
                                            value="jwk"
                                            checked=${importFormat.value === 'jwk'}
                                        />
                                        JWK
                                    </label>
                                ` : html`
                                    <label class="radio-label">
                                        <input
                                            type="radio"
                                            name="import-format"
                                            value="jwk"
                                            checked=${importFormat.value === 'jwk'}
                                        />
                                        JWK
                                    </label>
                                    <label class="radio-label">
                                        <input
                                            type="radio"
                                            name="import-format"
                                            value="pem"
                                            checked=${importFormat.value === 'pem'}
                                        />
                                        PEM
                                    </label>
                                `}
                            </div>
                            ${keyType === 'ecc' && html`
                                <p class="info-text" style="margin-top: 0.5rem;">
                                    ${importFormat.value === 'raw' ? html`
                                        Raw format is the 32-byte Ed25519 private key seed
                                        encoded as a base64url string (no padding).
                                        This is just the raw key material without any
                                        wrapper format like JWK.
                                    ` : html`
                                        JWK (JSON Web Key) format is a JSON object containing
                                        the private key with metadata fields. For Ed25519, this
                                        includes <code>kty</code>, <code>crv</code>, <code>x</code> (public key),
                                        and <code>d</code> (private key) fields.
                                    `}
                                </p>
                            `}
                        </div>

                        <label for="privateKey">
                            Private Key (${importFormat.value.toUpperCase()}):
                        </label>
                        <textarea
                            id="privateKey"
                            name="privateKey"
                            required=${true}
                            value=${importPrivateKey.value}
                            onInput=${(e:any) => {
                                importPrivateKey.value = e.target.value
                            }}
                            placeholder=${
                                keyType === 'ecc' ?
                                    (importFormat.value === 'raw' ?
                                        'Paste your Ed25519 private key seed as base64url (32 bytes)' :
                                        'Paste your Ed25519 private key in JWK format') :
                                    (importFormat.value === 'jwk' ?
                                        'Paste your RSA private key in JWK format' :
                                        'Paste your RSA private key in PEM format')
                            }
                            rows="6"
                        ></textarea>

                        <button class="action-button" type="submit">
                            Import and Derive Public Key
                        </button>
                    </form>
                `}

                ${hasKeys && html`
                    <div class="form-group">
                        <h3>Public Key Encoding:</h3>
                        <div
                            class="radio-group"
                            onChange=${handlePublicKeyEncodingChange}
                        >
                            <label class="radio-label">
                                <input
                                    type="radio"
                                    name="gen-encoding"
                                    value="base64pad"
                                    checked=${state.encodings.publicKey.value ===
                                        'base64pad'}
                                />
                                Base64Pad
                            </label>
                            <label class="radio-label">
                                <input
                                    type="radio"
                                    name="gen-encoding"
                                    value="base64url"
                                    checked=${state.encodings.publicKey.value ===
                                        'base64url'}
                                />
                                Base64URL
                            </label>
                            <label class="radio-label">
                                <input
                                    type="radio"
                                    name="gen-encoding"
                                    value="base58btc"
                                    checked=${state.encodings.publicKey.value ===
                                        'base58btc'}
                                />
                                Base58
                            </label>
                            <label class="radio-label">
                                <input
                                    type="radio"
                                    name="gen-encoding"
                                    value="hex"
                                    checked=${state.encodings.publicKey.value ===
                                        'hex'}
                                />
                                Hex
                            </label>
                            <label class="radio-label">
                                <input
                                    type="radio"
                                    name="gen-encoding"
                                    value="multikey"
                                    checked=${state.encodings.publicKey.value ===
                                        'multikey'}
                                />
                                Multikey
                            </label>
                        </div>
                    </div>

                    <div class="key-display">
                        <h4>DID:</h4>
                        <div class="output-field">
                            <div class="output-content">${state.did.value}</div>
                            <copy-button
                                payload=${state.did.value || 'placeholder'}
                            >
                            </copy-button>
                        </div>
                        <p class="info-text">
                            A <code>did:key</code> string
                            is the public key plus a multicodec prefix that
                            specifies the key type
                            (e.g., 0xed01 for Ed25519, 0x1205 for RSA),
                            plust the public key as a base58btc encoded string
                            with the multibase 'z' prefix.
                        </p>
                    </div>

                    <div class="key-display">
                        <h3>
                            Public Key (${state.encodings.publicKey.value}):
                        </h3>
                        <div class="output-field">
                            <div class="output-content">
                                ${encodedValue.value}
                            </div>
                            <copy-button
                                payload=${
                                    encodedValue.value ||
                                    'placeholder'
                                }
                            >
                            </copy-button>
                        </div>
                    </div>

                    <div class="key-display">
                        <h3>
                            Private Key (${state.encodings.publicKey.value}):
                        </h3>
                        <div class="output-field">
                            <div class="output-content">
                                ${encodedPrivateKeyValue.value}
                            </div>
                            <copy-button
                                payload=${
                                    encodedPrivateKeyValue.value ||
                                    'placeholder'
                                }
                            >
                            </copy-button>
                        </div>
                    </div>

                    <form class="form-group" onSubmit=${signMessage}>
                        <label for="message">Message to Sign:</label>
                        <textarea
                            id="message"
                            name="message"
                            required=${true}
                            placeholder="Enter message to sign"
                            rows="4"
                        ></textarea>

                        <div class="controls">
                            <button
                                class="action-button"
                                type="submit"
                            >
                                Sign Message
                            </button>
                        </div>
                    </form>

                    <div class="form-group">
                        <label>Signature Encoding:</label>
                        <div
                            class="radio-group"
                            onChange=${handleSignatureEncodingChange}
                        >
                            <label class="radio-label">
                                <input
                                    type="radio"
                                    name="gen-sig-encoding"
                                    value="base64pad"
                                    checked=${state.encodings.signature.value ===
                                        'base64pad'}
                                />
                                Base64Pad
                            </label>
                            <label class="radio-label">
                                <input
                                    type="radio"
                                    name="gen-sig-encoding"
                                    value="base64url"
                                    checked=${state.encodings.signature.value ===
                                        'base64url'}
                                />
                                Base64URL
                            </label>
                            <label class="radio-label">
                                <input
                                    type="radio"
                                    name="gen-sig-encoding"
                                    value="base58btc"
                                    checked=${state.encodings.signature.value ===
                                        'base58btc'}
                                />
                                Base58
                            </label>
                            <label class="radio-label">
                                <input
                                    type="radio"
                                    name="gen-sig-encoding"
                                    value="hex"
                                    checked=${state.encodings.signature.value ===
                                        'hex'}
                                />
                                Hex
                            </label>
                        </div>
                    </div>

                    <div class="key-display">
                        <h3>Signature (${state.encodings.signature.value}):</h3>
                        <div class="output-field">
                            <div class="output-content">
                                ${sigString}
                            </div>
                            <copy-button payload=${sigString.value || 'placeholder'}></copy-button>
                        </div>
                    </div>
                `}
            </div>

            <div class="col-half">
                <h2>Verifier</h2>

                <form onSubmit=${handleVerify} class="verification-form">
                    <div class="form-group encoding">
                        <h3>Signature Encoding:</h3>
                        <div class="radio-group" onChange=${handleVerifierSignatureEncodingChange}>
                            <label class="radio-label">
                                <input
                                    type="radio"
                                    name="ver-sig-encoding"
                                    value="base64pad"
                                    checked=${state.verifier.signatureEncoding.value === 'base64pad'}
                                />
                                Base64Pad
                            </label>
                            <label class="radio-label">
                                <input
                                    type="radio"
                                    name="ver-sig-encoding"
                                    value="base64url"
                                    checked=${state.verifier.signatureEncoding.value === 'base64url'}
                                />
                                Base64URL
                            </label>
                            <label class="radio-label">
                                <input
                                    type="radio"
                                    name="ver-sig-encoding"
                                    value="base58btc"
                                    checked=${state.verifier.signatureEncoding.value === 'base58btc'}
                                />
                                Base58
                            </label>
                            <label class="radio-label">
                                <input
                                    type="radio"
                                    name="ver-sig-encoding"
                                    value="hex"
                                    checked=${state.verifier.signatureEncoding.value === 'hex'}
                                />
                                Hex
                            </label>
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="ver-signature">
                            Signature (${state.verifier.signatureEncoding.value}):
                        </label>
                        <textarea
                            id="ver-signature"
                            value=${state.verifier.signature.value}
                            onInput=${(e:any) => {
                                state.verifier.signature.value = e.target.value
                            }}
                            placeholder="Enter the signature"
                            rows="3"
                        ></textarea>
                    </div>

                    <div class="form-group encoding">
                        <h3>Public Key Encoding:</h3>
                        <div class="radio-group" onChange=${handleVerifierPublicKeyEncodingChange}>
                            <label class="radio-label">
                                <input
                                    type="radio"
                                    name="ver-key-encoding"
                                    value="base64pad"
                                    checked=${state.verifier.publicKeyEncoding.value === 'base64pad'}
                                />
                                Base64Pad
                            </label>
                            <label class="radio-label">
                                <input
                                    type="radio"
                                    name="ver-key-encoding"
                                    value="base64url"
                                    checked=${state.verifier.publicKeyEncoding.value === 'base64url'}
                                />
                                Base64URL
                            </label>
                            <label class="radio-label">
                                <input
                                    type="radio"
                                    name="ver-key-encoding"
                                    value="base58btc"
                                    checked=${state.verifier.publicKeyEncoding.value === 'base58btc'}
                                />
                                Base58
                            </label>
                            <label class="radio-label">
                                <input
                                    type="radio"
                                    name="ver-key-encoding"
                                    value="hex"
                                    checked=${state.verifier.publicKeyEncoding.value === 'hex'}
                                />
                                Hex
                            </label>
                            <label class="radio-label">
                                <input
                                    type="radio"
                                    name="ver-key-encoding"
                                    value="multikey"
                                    checked=${state.verifier.publicKeyEncoding.value === 'multikey'}
                                />
                                Multikey
                            </label>
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="ver-publicKey">
                            DID or public key (${state.verifier.publicKeyEncoding.value}):
                        </label>
                        <textarea
                            id="ver-publicKey"
                            value=${state.verifier.publicKey.value}
                            onInput=${(e:any) => {
                                state.verifier.publicKey.value = e.target.value
                            }}
                            placeholder="Enter DID or public key"
                            rows="3"
                        ></textarea>
                    </div>

                    <div class="form-group">
                        <label for="ver-message">Message:</label>
                        <textarea
                            id="ver-message"
                            name="ver-message"
                            placeholder="Enter the message that was signed"
                            rows="4"
                        ></textarea>
                    </div>

                    <div class="controls">
                        <button type="submit" class="verify-button">
                            Verify Signature
                        </button>
                    </div>

                </form>

                ${state.verifier.result.value && html`
                    <div class="result ${state.verifier.result.value.valid ?
                        'valid' : 'invalid'}"
                    >
                        <h3>
                            ${state.verifier.result.value.valid ? '✓ Valid Signature' : '✗ Invalid Signature'}
                        </h3>
                        ${state.verifier.result.value.error && html`
                            <p class="error">
                                Error: ${state.verifier.result.value.error}
                            </p>
                        `}
                    </div>
                `}
            </div>
        </div>
    </div>`
}
