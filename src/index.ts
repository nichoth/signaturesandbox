import { html } from 'htm/preact'
import { FunctionComponent, render } from 'preact'
import { State } from './state.js'
import Router from './routes/index.js'
import '@substrate-system/copy-button'
import '@substrate-system/copy-button/css'
import './style.css'
import '@substrate-system/a11y'
import '@substrate-system/css-normalize'

const router = Router()
const state = State()

if (import.meta.env.DEV || import.meta.env.MODE !== 'production') {
    // @ts-expect-error DEV env
    window.state = state
}

export const App:FunctionComponent = function App () {
    const match = router.match(state.route.value)

    if (!match || !match.action) {
        return html`<div class="404">
            <h1>404</h1>
            <p>Page not found</p>
            <a href="/">Go home</a>
        </div>`
    }

    const ChildNode = match.action(match, state.route.value)

    return html`<div class="app">
        <${ChildNode} state=${state} />
    </div>`
}

render(html`<${App} />`, document.getElementById('root')!)
