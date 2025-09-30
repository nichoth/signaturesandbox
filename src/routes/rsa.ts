import { FunctionComponent } from 'preact'
import { State } from '../state.js'
import { SignatureRoute } from './signature-route.js'

export const RSARoute:FunctionComponent<{
    state:ReturnType<typeof State>;
}> = function RSARoute ({ state }) {
    return SignatureRoute({ state, keyType: 'rsa', title: 'RSA' })
}
