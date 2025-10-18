export function isDev () {
    return (import.meta.env.DEV || import.meta.env.MODE !== 'production')
}
