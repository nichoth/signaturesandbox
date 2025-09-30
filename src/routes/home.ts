import { html } from 'htm/preact'
import { FunctionComponent } from 'preact'

export const HomeRoute:FunctionComponent = function HomeRoute () {
    return html`<div class="route home">
        <h1>Signature Verification</h1>
        <p>Choose a signature type to verify:</p>
        <nav class="signature-nav">
            <ul>
                <li><a href="/ed25519">Ed25519 Signature Verification</a></li>
                <li><a href="/rsa">RSA Signature Verification</a></li>
                <li><a href="/ucan">UCAN Verification</a></li>
            </ul>
        </nav>
    </div>`
}
