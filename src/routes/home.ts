import { html } from 'htm/preact'
import { FunctionComponent } from 'preact'
import { ELLIPSIS } from '../constants.js'

export const HomeRoute:FunctionComponent = function HomeRoute () {
    return html`<div class="route home">
        <h1>Signature Sandbox</h1>

        <p>
            At last${ELLIPSIS} a place to cryptographically sign
            arbitrary string${ELLIPSIS}
        </p>

        <nav class="signature-nav">
            <ul>
                <li><a class="btn" href="/ed25519">Ed25519</a></li>
                <li><a class="btn" href="/rsa">RSA</a></li>
            </ul>
        </nav>
    </div>`
}
