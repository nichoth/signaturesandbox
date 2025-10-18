import { EccKeys } from '@substrate-system/keys/ecc'
import { RsaKeys } from '@substrate-system/keys/rsa'
import { batch, Signal, signal, effect } from '@preact/signals'
import { type SupportedEncodings, toString, fromString } from 'uint8arrays'
import Route from 'route-event'
import Debug from '@substrate-system/debug'
import { isDev } from './util.js'
const debug = Debug(isDev())

export type Uint8Encodings = Extract<SupportedEncodings,
    'base64pad'|'base64url'|'base58btc'|'hex'>

export function State ():{
    route:Signal<string>;
    eccKeys:Signal<EccKeys|null>;
    rsaKeys:Signal<RsaKeys|null>;
    did:Signal<string>;
    encodedPublicKeys:Signal<{
        base64pad:string;
        base58btc:string;
        base64url:string;
        hex:string;
    }|null>;
    encodedPrivateKeys:Signal<{
        base64pad:string;
        base58btc:string;
        base64url:string;
        hex:string;
    }|null>;
    _setRoute:(path:string)=>void;
    encodings:{
        publicKey:Signal<Uint8Encodings>;
        signature:Signal<Uint8Encodings>;
        verifierInput:Signal<Uint8Encodings>;
    };
    generator:{
        signatureBytes:Signal<Uint8Array|null>;
    };
    verifier:{
        message:Signal<string>;
        signature:Signal<string>;
        publicKey:Signal<string>;
        encoding:Signal<Uint8Encodings>;
        result:Signal<{ valid: boolean, error?: string } | null>;
    };
} {  // eslint-disable-line indent
    const onRoute = Route()

    const state = {
        _setRoute: onRoute.setRoute.bind(onRoute),
        eccKeys: signal<EccKeys|null>(null),
        rsaKeys: signal<RsaKeys|null>(null),
        did: signal<string>(''),
        route: signal<string>(location.pathname + location.search),
        encodedPublicKeys: signal<{
            base64pad:string;
            base58btc:string;
            base64url:string;
            hex:string;
        }|null>(null),
        encodedPrivateKeys: signal<{
            base64pad:string;
            base58btc:string;
            base64url:string;
            hex:string;
        }|null>(null),
        encodings: {
            publicKey: signal<Uint8Encodings>('base64pad'),
            signature: signal<Uint8Encodings>('base64pad'),
            verifierInput: signal<Uint8Encodings>('base64pad'),
        },
        generator: {
            signatureBytes: signal<Uint8Array|null>(null),
        },
        verifier: {
            message: signal<string>(''),
            signature: signal<string>(''),
            publicKey: signal<string>(''),
            encoding: signal<Uint8Encodings>('base64pad'),
            result: signal<{ valid:boolean, error?:string }|null>(null),
        }
    }

    /**
     * Automatically set the encoded keys when the keys change
     */
    effect(() => {
        if (!state.eccKeys.value && !state.rsaKeys.value) return

        (async () => {
            if (state.eccKeys.value) {
                const keys = state.eccKeys.value
                state.encodedPublicKeys.value = {
                    base58btc: await keys.publicWriteKey.asString('base58btc'),
                    base64pad: await keys.publicWriteKey.asString('base64pad'),
                    base64url: await keys.publicWriteKey.asString('base64url'),
                    hex: await keys.publicWriteKey.asString('hex')
                }

                // Export private key as Uint8Array
                const privateKeyJwk = await crypto.subtle.exportKey(
                    'jwk',
                    keys.writeKey.privateKey
                )
                if (!privateKeyJwk.d) {
                    throw new Error('Failed to export private key')
                }

                const privateKeyBytes = fromString(privateKeyJwk.d, 'base64url')

                state.encodedPrivateKeys.value = {
                    base64pad: toString(privateKeyBytes, 'base64pad'),
                    base64url: toString(privateKeyBytes, 'base64url'),
                    base58btc: toString(privateKeyBytes, 'base58btc'),
                    hex: toString(privateKeyBytes, 'hex')
                }
            } else if (state.rsaKeys.value) {
                const keys = state.rsaKeys.value
                state.encodedPublicKeys.value = {
                    base58btc: await keys.publicWriteKey.asString('base58btc'),
                    base64pad: await keys.publicWriteKey.asString('base64pad'),
                    base64url: await keys.publicWriteKey.asString('base64url'),
                    hex: await keys.publicWriteKey.asString('hex')
                }

                // Export private key as Uint8Array
                const { toString } = await import('uint8arrays')
                const privateKeyPkcs8 = await crypto.subtle.exportKey(
                    'pkcs8',
                    keys.writeKey.privateKey
                )
                const privateKeyBytes = new Uint8Array(privateKeyPkcs8)

                state.encodedPrivateKeys.value = {
                    base64pad: toString(privateKeyBytes, 'base64pad'),
                    base64url: toString(privateKeyBytes, 'base64url'),
                    base58btc: toString(privateKeyBytes, 'base58btc'),
                    hex: toString(privateKeyBytes, 'hex')
                }
            }
        })()
    })

    /**
     * set the app state to match the browser URL
     */
    onRoute((path:string, data) => {
        const newPath = path
        batch(() => {
            state.route.value = newPath
            State.reset(state)
        })
        // handle scroll state like a web browser
        // (restore scroll position on back/forward)
        if (data.popstate) {
            return window.scrollTo(data.scrollX, data.scrollY)
        }
        // if this was a link click (not back button), then scroll to top
        window.scrollTo(0, 0)
    })

    return state
}

State.reset = function (state:ReturnType<typeof State>) {
    batch(() => {
        Object.keys(state.verifier).forEach(k => {
            if (k === 'encoding') {
                state.verifier[k].value = 'base64pad'
            } else if (k === 'result') {
                state.verifier[k].value = null
            } else {
                state.verifier[k].value = ''
            }
        })
    })
}

State.setPublicKeyEncoding = function (
    state:ReturnType<typeof State>,
    newValue:Uint8Encodings
) {
    state.encodings.publicKey.value = newValue
}

State.setSignatureEncoding = function (
    state:ReturnType<typeof State>,
    newValue:Uint8Encodings
) {
    state.encodings.signature.value = newValue
}

State.setVerifierEncoding = function (
    state:ReturnType<typeof State>,
    newValue:Uint8Encodings
) {
    state.verifier.encoding.value = newValue
}

State.generateEcc = async function (
    state:ReturnType<typeof State>
):Promise<EccKeys> {
    const keys = await EccKeys.create(true, true)

    debug('the keys...', keys)

    batch(async () => {
        state.eccKeys.value = keys
        state.did.value = keys.DID
    })

    return keys
}

State.generateRsa = async function (
    state:ReturnType<typeof State>
):Promise<RsaKeys> {
    const keys = await RsaKeys.create(true, true)
    const did = keys.DID

    batch(async () => {
        state.rsaKeys.value = keys
        state.did.value = did
    })

    return keys
}
