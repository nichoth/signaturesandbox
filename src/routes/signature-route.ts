import { html } from 'htm/preact'
import { FunctionComponent } from 'preact'
import { useCallback } from 'preact/hooks'
import { type DID } from '@substrate-system/keys'
import { verify, publicKeyToDid } from '@substrate-system/keys/crypto'
import * as u8 from 'uint8arrays'
import Debug from '@substrate-system/debug'
import { State, type Uint8Encodings } from '../state.js'
import { useComputed, useSignal } from '@preact/signals'
import { EccKeys } from '@substrate-system/keys/ecc'
import { RsaKeys } from '@substrate-system/keys/rsa'
import '@substrate-system/copy-button'

const debug = Debug(import.meta.env.DEV)
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
    debug('rendering...', state, keyType)

    const encodedValue = useComputed<string>(() => {
        return state.encodedPublicKeys.value?.[state.encodings.publicKey.value] || ''
    })

    const showImportForm = useSignal<boolean>(false)
    const importPrivateKey = useSignal<string>('')
    const importEncoding = useSignal<Uint8Encodings>('base64pad')

    const sigString = useComputed<string|null>(() => {
        if (!state.generator.signatureBytes.value) return null

        return toString(
            state.generator.signatureBytes.value,
            state.encodings.signature.value
        )
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
            State.setPublicKeyEncoding(state, target.value as Uint8Encodings)
        }
    }, [state])

    const handleSignatureEncodingChange = useCallback((ev:Event) => {
        const target = ev.target as HTMLInputElement
        if (target.type === 'radio' && target.checked) {
            State.setSignatureEncoding(state, target.value as Uint8Encodings)
        }
    }, [state])

    const handleVerifierEncodingChange = useCallback((ev:Event) => {
        const target = ev.target as HTMLInputElement
        if (target.type === 'radio' && target.checked) {
            State.setVerifierEncoding(state, target.value as Uint8Encodings)
        }
    }, [state])

    const handleImportEncodingChange = useCallback((ev:Event) => {
        const target = ev.target as HTMLInputElement
        if (target.type === 'radio' && target.checked) {
            importEncoding.value = target.value as Uint8Encodings
        }
    }, [])

    const handleImportPrivateKey = useCallback(async (ev:SubmitEvent) => {
        ev.preventDefault()
        const form = ev.target as HTMLFormElement
        const privateKeyStr = form.elements['privateKey'].value.trim()

        try {
            // Convert private key from the selected encoding to bytes
            const privateKeyBytes = fromString(
                privateKeyStr,
                importEncoding.value
            ) as Uint8Array<ArrayBuffer>

            // Import based on key type
            if (keyType === 'ecc') {
                const privateKey = await crypto.subtle.importKey(
                    'raw',
                    privateKeyBytes,
                    { name: 'Ed25519' },
                    true,
                    ['sign']
                )

                // Derive the public key
                const jwk = await crypto.subtle.exportKey('jwk', privateKey)
                if (!jwk.x) throw new Error('Failed to export public key')

                const publicKeyBytes = fromString(
                    jwk.x,
                    state.encodings.publicKey.value
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
                // For RSA, import as PKCS8
                const privateKey = await crypto.subtle.importKey(
                    'pkcs8',
                    privateKeyBytes,
                    {
                        name: 'RSA-PSS',
                        hash: 'SHA-256'
                    },
                    true,
                    ['sign']
                )

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
                encoding: state.verifier.encoding.value
            })

            // Convert signature to bytes from the selected encoding
            const sigBytes = fromString(sigStr, state.verifier.encoding.value)

            // Convert back to base64pad string (what ed25519Verify expects)
            // const sigBase64Pad = toString(sigBytes, 'base64pad')

            let did:DID
            const publicKeyValue = state.verifier.publicKey.value.trim()
            if (publicKeyValue.startsWith('did:key:')) {
                did = publicKeyValue as DID
            } else {
                const pubKeyBytes = fromString(
                    publicKeyValue,
                    state.verifier.encoding.value
                )
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

        <nav>
            <ul>
                <li><a href="/">${'<'} Back to home</a></li>
            </ul>
        </nav>

        <div class="two-column-layout">
            <div class="col-half">
                <h2>Keys</h2>

                <button class="action-button" onClick=${generateKeys}>
                    Generate ${keyType === 'ecc' ? 'Ed25519' : 'RSA'} Keypair
                </button>

                <button
                    class="action-button"
                    onClick=${() => { showImportForm.value = !showImportForm.value }}
                >
                    ${showImportForm.value ? 'Cancel Import' : 'Import Private Key'}
                </button>

                ${showImportForm.value && html`
                    <form class="form-group" onSubmit=${handleImportPrivateKey}>
                        <div class="form-group">
                            <label>Private Key Encoding:</label>
                            <div
                                class="radio-group"
                                onChange=${handleImportEncodingChange}
                            >
                                <label class="radio-label">
                                    <input
                                        type="radio"
                                        name="import-encoding"
                                        value="base64pad"
                                        checked=${importEncoding.value === 'base64pad'}
                                    />
                                    Base64Pad
                                </label>
                                <label class="radio-label">
                                    <input
                                        type="radio"
                                        name="import-encoding"
                                        value="base64url"
                                        checked=${importEncoding.value === 'base64url'}
                                    />
                                    Base64URL
                                </label>
                                <label class="radio-label">
                                    <input
                                        type="radio"
                                        name="import-encoding"
                                        value="base58btc"
                                        checked=${importEncoding.value === 'base58btc'}
                                    />
                                    Base58
                                </label>
                            </div>
                        </div>

                        <label for="privateKey">
                            Private Key (${importEncoding.value}):
                        </label>
                        <textarea
                            id="privateKey"
                            name="privateKey"
                            required=${true}
                            value=${importPrivateKey.value}
                            onInput=${(e:any) => {
                                importPrivateKey.value = e.target.value
                            }}
                            placeholder="Paste your private key here"
                            rows="4"
                        ></textarea>

                        <button class="action-button" type="submit">
                            Import and Derive Public Key
                        </button>
                    </form>
                `}

                ${hasKeys && html`
                    <div class="form-group">
                        <label>Public Key Encoding:</label>
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
                                ${state.encodedPrivateKeys.value?.[state.encodings.publicKey.value] || ''}
                            </div>
                            <copy-button
                                payload=${
                                    state.encodedPrivateKeys.value?.[state.encodings.publicKey.value] ||
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

                        <button
                            class="action-button"
                            type="submit"
                        >
                            Sign Message
                        </button>
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
                    <div class="form-group">
                        <label>Encoding:</label>
                        <div class="radio-group" onChange=${handleVerifierEncodingChange}>
                            <label class="radio-label">
                                <input
                                    type="radio"
                                    name="ver-encoding"
                                    value="base64pad"
                                    checked=${state.verifier.encoding.value === 'base64pad'}
                                />
                                Base64Pad
                            </label>
                            <label class="radio-label">
                                <input
                                    type="radio"
                                    name="ver-encoding"
                                    value="base64url"
                                    checked=${state.verifier.encoding.value === 'base64url'}
                                />
                                Base64URL
                            </label>
                            <label class="radio-label">
                                <input
                                    type="radio"
                                    name="ver-encoding"
                                    value="base58btc"
                                    checked=${state.verifier.encoding.value === 'base58btc'}
                                />
                                Base58
                            </label>
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="ver-signature">
                            Signature (${state.verifier.encoding.value}):
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

                    <div class="form-group">
                        <label for="ver-publicKey">
                            DID:
                        </label>
                        <textarea
                            id="ver-publicKey"
                            value=${state.verifier.publicKey.value}
                            onInput=${(e:any) => {
                                state.verifier.publicKey.value = e.target.value
                            }}
                            placeholder="The signing DID"
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

                    <button type="submit" class="verify-button">
                        Verify Signature
                    </button>
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
