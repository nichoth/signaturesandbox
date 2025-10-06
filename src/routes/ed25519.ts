import { FunctionComponent } from 'preact'
import { State } from '../state.js'
import { SignatureRoute } from './signature-route.js'

export const Ed25519Route:FunctionComponent<{
    state:ReturnType<typeof State>;
}> = function Ed25519Route ({ state }) {
    return SignatureRoute({ state, keyType: 'ecc', title: 'Ed25519' })
}
