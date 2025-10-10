import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkgPath = resolve(__dirname, '..', 'package.json')

if (process.env.NETLIFY) {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
    const removed = []
    for (const sect of ['dependencies', 'devDependencies', 'optionalDependencies']) {
        if (pkg[sect]?.['@substrate-system/tapout']) {
            delete pkg[sect]['@substrate-system/tapout']
            removed.push(sect)
        }
    }
    if (removed.length) {
        writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
        console.log(`Pruned @substrate-system/tapout from: ${removed.join(', ')}`)
    } else {
        console.log('No @substrate-system/tapout to prune.')
    }
}
