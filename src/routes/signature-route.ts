import { html } from 'htm/preact'
import { FunctionComponent } from 'preact'
import { useCallback } from 'preact/hooks'
import { type DID } from '@substrate-system/keys'
import { verify, publicKeyToDid } from '@substrate-system/keys/crypto'
import { fromString, toString } from 'uint8arrays'
import Debug from '@substrate-system/debug'
import { State, type Uint8Encodings } from '../state.js'
import { useComputed } from '@preact/signals'
import '@substrate-system/copy-button'

const debug = Debug(import.meta.env.DEV)

type KeyType = 'ecc'|'rsa'

export const SignatureRoute:FunctionComponent<{
    state:ReturnType<typeof State>;
    keyType:KeyType;
    title:string;
}> = function SignatureRoute ({ state, keyType, title }) {
    debug('rendering...', state, keyType)

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

    const handleVerify = useCallback(async (ev:SubmitEvent) => {
        ev.preventDefault()
        state.verifier.result.value = null

        try {
            const msgStr = state.verifier.message.value
            const sigStr = state.verifier.signature.value.trim()

            debug('Verifying signature:', {
                message: msgStr,
                signature: sigStr,
                encoding: state.verifier.encoding.value
            })

            // Convert signature to bytes from the selected encoding
            const sigBytes = fromString(sigStr, state.verifier.encoding.value)

            // Convert back to base64pad string (what ed25519Verify expects)
            const sigBase64Pad = toString(sigBytes, 'base64pad')

            let didKey:DID
            const publicKeyValue = state.verifier.publicKey.value.trim()
            if (publicKeyValue.startsWith('did:key:')) {
                didKey = publicKeyValue as DID
            } else {
                const pubKeyBytes = fromString(
                    publicKeyValue,
                    state.verifier.encoding.value
                )
                // Specify 'ed25519' as the key type
                // (defaults to 'rsa' otherwise)
                didKey = await publicKeyToDid(pubKeyBytes, 'ed25519')
            }

            const isValid = await verify({
                message: msgStr,
                publicKey: didKey,
                signature: sigBase64Pad
            })
            state.verifier.result.value = { valid: isValid }
        } catch (error) {
            console.error('Verification error:', error)
            state.verifier.result.value = {
                valid: false,
                error: (error as Error).message
            }
        }
    }, [])

    const hasKeys = keyType === 'ecc' ? state.eccKeys.value : state.rsaKeys.value

    return html`<div class="route ${keyType}-route">
        <h1>${title}</h1>

        <nav>
            <ul>
                <li><a href="/">← Back to home</a></li>
            </ul>
        </nav>

        <div class="two-column-layout">
            <div class="col-half">
                <h2>Keys</h2>

                <button class="action-button" onClick=${generateKeys}>
                    Generate ${keyType === 'ecc' ? 'Ed25519' : 'RSA'} Keypair
                </button>

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
                                ${state.encodedKeys.value?.[state.encodings.publicKey.value] || ''}
                            </div>
                            <copy-button
                                payload=${
                                    state.encodedKeys.value?.[state.encodings.publicKey.value] ||
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
                            <div for="message" class="output-content">
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
                        <label for="ver-signature">Signature (${state.verifier.encoding.value}):</label>
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
                            Public Key (${state.verifier.encoding.value}) or DID:
                        </label>
                        <textarea
                            id="ver-publicKey"
                            value=${state.verifier.publicKey.value}
                            onInput=${(e:any) => {
                                state.verifier.publicKey.value = e.target.value
                            }}
                            placeholder="Enter the public key or DID"
                            rows="3"
                        ></textarea>
                    </div>

                    <div class="form-group">
                        <label for="ver-message">Message:</label>
                        <textarea
                            id="ver-message"
                            value=${state.verifier.message.value}
                            onInput=${(e:any) => {
                                state.verifier.message.value = e.target.value
                            }}
                            placeholder="Enter the message that was signed"
                            rows="4"
                        ></textarea>
                    </div>

                    <button type="submit" class="verify-button">Verify Signature</button>
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
