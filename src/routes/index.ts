import Router from '@substrate-system/routes'
import { HomeRoute } from './home.js'
import { Ed25519Route } from './ed25519.js'
import { RSARoute } from './rsa.js'
import { UCANRoute } from './ucan.js'

export default function _Router ():Router {
    const router = new Router()

    router.addRoute('/', () => {
        return HomeRoute
    })

    router.addRoute('/ed25519', () => {
        return Ed25519Route
    })

    router.addRoute('/rsa', () => {
        return RSARoute
    })

    router.addRoute('/ucan', () => {
        return UCANRoute
    })

    return router
}
