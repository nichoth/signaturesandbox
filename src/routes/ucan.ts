import { html } from 'htm/preact'
import { FunctionComponent } from 'preact'
import { signal } from '@preact/signals'
import { validate } from '@ucans/ucans'

const ucanToken = signal('')
const result = signal<{ valid: boolean, error?: string, details?: any } | null>(null)

export const UCANRoute:FunctionComponent = function UCANRoute () {
    async function handleVerify (ev:Event) {
        ev.preventDefault()
        result.value = null

        try {
            // Validate the UCAN token
            const ucan = await validate(ucanToken.value.trim())

            // If validation succeeds, extract some details
            const payload = ucan.payload
            const details = {
                issuer: payload.iss,
                audience: payload.aud,
                expiration: payload.exp ? new Date(payload.exp * 1000).toISOString() : 'N/A',
                notBefore: payload.nbf ? new Date(payload.nbf * 1000).toISOString() : 'N/A',
                capabilities: payload.att || []
            }

            result.value = {
                valid: true,
                details
            }
        } catch (error) {
            result.value = {
                valid: false,
                error: (error as Error).message
            }
        }
    }

    return html`<div class="route ucan-route">
        <h1>UCAN Verification</h1>
        <a href="/">← Back to home</a>

        <form onSubmit=${handleVerify} class="verification-form">
            <div class="form-group">
                <label for="ucanToken">UCAN Token:</label>
                <textarea
                    id="ucanToken"
                    value=${ucanToken.value}
                    onInput=${(e:any) => { ucanToken.value = e.target.value }}
                    placeholder="Paste your UCAN token here (JWT format)"
                    rows="8"
                />
            </div>

            <button type="submit" class="verify-button">Verify UCAN</button>
        </form>

        ${result.value && html`
            <div class="result ${result.value.valid ? 'valid' : 'invalid'}">
                <h3>${result.value.valid ? '✓ Valid UCAN' : '✗ Invalid UCAN'}</h3>
                ${result.value.error && html`<p class="error">Error: ${result.value.error}</p>`}
                ${result.value.details && html`
                    <div class="ucan-details">
                        <h4>UCAN Details:</h4>
                        <dl>
                            <dt>Issuer:</dt>
                            <dd>${result.value.details.issuer}</dd>
                            <dt>Audience:</dt>
                            <dd>${result.value.details.audience}</dd>
                            <dt>Expiration:</dt>
                            <dd>${result.value.details.expiration}</dd>
                            <dt>Not Before:</dt>
                            <dd>${result.value.details.notBefore}</dd>
                            <dt>Capabilities:</dt>
                            <dd>
                                <pre>${JSON.stringify(result.value.details.capabilities, null, 2)}</pre>
                            </dd>
                        </dl>
                    </div>
                `}
            </div>
        `}
    </div>`
}
