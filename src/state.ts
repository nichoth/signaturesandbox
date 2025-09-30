import { EccKeys } from '@substrate-system/keys/ecc'
import { RsaKeys } from '@substrate-system/keys/rsa'
import { batch, Signal, signal } from '@preact/signals'
import Route from 'route-event'

type Uint8Encodings = 'base64'|'base64url'|'base58'|'hex'

export function State ():{
    route:Signal<string>;
    eccKeys:Signal<EccKeys|null>;
    rsaKeys:Signal<RsaKeys|null>;
    encodedKeys:Signal<{
        base64:string;
        base58:string;
        base64url:string;
        hex:string;
    }|null>;
    _setRoute:(path:string)=>void;
    encodings:{
        publicKey:Signal<Uint8Encodings>;
        verifierInput:Signal<Uint8Encodings>;
    }
} {  // eslint-disable-line indent
    const onRoute = Route()

    const state = {
        _setRoute: onRoute.setRoute.bind(onRoute),
        eccKeys: signal(null),
        rsaKeys: signal(null),
        route: signal<string>(location.pathname + location.search),
        encodedKeys: signal(null),
        encodings: {
            publicKey: signal('base64' as const),
            verifierInput: signal('base64' as const),
        }
    }

    /**
     * set the app state to match the browser URL
     */
    onRoute((path:string, data) => {
        const newPath = path
        state.route.value = newPath
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

State.generateEcc = async function (
    state:ReturnType<typeof State>
):Promise<EccKeys> {
    const keys = await EccKeys.create(true, true)
    batch(async () => {
        state.eccKeys.value = keys
        state.encodedKeys.value = {
            base58: await keys.publicWriteKey.asString('base58btc'),
            base64: await keys.publicWriteKey.asString('base64'),
            base64url: await keys.publicWriteKey.asString('base64url'),
            hex: await keys.publicWriteKey.asString('hex')
        }
    })

    return keys
}

State.chooseEncoding = function (state) {

}

State.generateRsa = async function (
    state:ReturnType<typeof State>
):Promise<RsaKeys> {
    const keys = await RsaKeys.create(true, true)
    batch(async () => {
        state.rsaKeys.value = keys
        state.encodedKeys.value = {
            base58: await keys.publicWriteKey.asString('base58btc'),
            base64: await keys.publicWriteKey.asString('base64'),
            base64url: await keys.publicWriteKey.asString('base64url'),
            hex: await keys.publicWriteKey.asString('hex')
        }
    })

    return keys
}
