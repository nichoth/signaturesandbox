import { html } from 'htm/preact'
import { FunctionComponent } from 'preact'
import { ELLIPSIS, EM_DASH } from '../constants.js'

export const HomeRoute:FunctionComponent = function HomeRoute () {
    return html`<div class="route home">
        <h1>Signature Sandbox</h1>

        <p>
            At last${ELLIPSIS} a place to cryptographically sign
            arbitrary strings${ELLIPSIS}
        </p>

        <p>
            This uses the <a href="https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API">
            Web Crypto API</a> to sign and verify things in your browser
            ${' ' + EM_DASH} no servers required.
        </p>

        <nav class="signature-nav">
            <ul>
                <li><a class="btn" href="/ed25519">Ed25519</a></li>
                <li><a class="btn" href="/rsa">RSA</a></li>
            </ul>
        </nav>
    </div>`
}
