import { html } from 'htm/preact'
import { FunctionComponent } from 'preact'

export const HomeRoute:FunctionComponent = function HomeRoute () {
    return html`<div class="route home">
        <h1>Signature Verification</h1>

        <nav class="signature-nav">
            <ul>
                <li><a class="btn" href="/ed25519">Ed25519</a></li>
                <li><a class="btn" href="/rsa">RSA</a></li>
                <li><a class="btn" href="/ucan">UCAN Verification</a></li>
            </ul>
        </nav>
    </div>`
}
