const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const settingsPath = '/etc/abbey/settings.yml'
const envPath = '/etc/abbey/.env'

try {
    const settings = yaml.load(fs.readFileSync(settingsPath, 'utf8'));
    const env = dotenv.parse(fs.readFileSync(envPath));

    let envContent = '';
    function addEnv(name, val){
        const escaped = (''+val).replace(/'/g, "\\'")
        envContent += `${name}='${escaped}'\n`
    }

    // Defaults to ports 5000 / 3000 and "backend" name for the service on the internal network.
    let public_backend_url = "http://localhost:5000"
    let public_frontend_url = "http://localhost:3000"
    let internal_backend_url = "http://backend:5000"
    if (settings.services?.backend?.public_url){
        public_backend_url = settings.services?.backend?.public_url
    }
    if (settings.services?.frontend?.public_url){
        public_frontend_url = settings.services?.frontend?.public_url
    }
    if (settings.services?.backend?.internal_url){
        internal_backend_url = settings.services?.backend?.internal_url
    }
    addEnv('NEXT_PUBLIC_BACKEND_URL', public_backend_url)
    addEnv('NEXT_PUBLIC_ROOT_URL', public_frontend_url)
    addEnv('NEXT_SERVER_SIDE_BACKEND_URL', internal_backend_url)

    // Auth
    // "system" is blank then we're using custom auth
    if (!settings['auth']?.system || settings['auth'].system == 'custom'){
        addEnv('NEXT_PUBLIC_AUTH_SYSTEM', 'custom')
        if (env['CUSTOM_AUTH_SECRET']){
            addEnv('JWT_SECRET', env['CUSTOM_AUTH_SECRET'])
            if (env['REFRESH_TOKEN_SECRET']){
                addEnv('REFRESH_TOKEN_SECRET', env['REFRESH_TOKEN_SECRET'])
            }
            else {
                addEnv('REFRESH_TOKEN_SECRET', env['CUSTOM_AUTH_SECRET'])
            }
        }
        else {
            addEnv('JWT_SECRET', 'not-a-secret')  // Matched on backend (see there if you want to change it)
            addEnv('REFRESH_TOKEN_SECRET', 'not-a-secret')
        }
        // Add any appropriate provider keys
        if (settings.auth.providers?.length){
            for (const provider of settings.auth.providers){
                if (provider == 'google'){
                    addEnv('NEXT_PUBLIC_ENABLE_GOOGLE_AUTH', 1)
                    addEnv('GOOGLE_CLIENT_ID', env['GOOGLE_CLIENT_ID'])
                    addEnv('GOOGLE_SECRET', env['GOOGLE_SECRET'])
                }
                else if (provider == 'github'){
                    addEnv('NEXT_PUBLIC_ENABLE_GITHUB_AUTH', 1)
                    addEnv('GITHUB_CLIENT_ID', env['GITHUB_CLIENT_ID'])
                    addEnv('GITHUB_SECRET', env['GITHUB_SECRET'])
                }
                else if (provider == 'keycloak'){
                    addEnv('NEXT_PUBLIC_ENABLE_KEYCLOAK_AUTH', 1)
                    addEnv('KEYCLOAK_PUBLIC_URL', env['KEYCLOAK_PUBLIC_URL'])
                    addEnv('KEYCLOAK_INTERNAL_URL', env['KEYCLOAK_INTERNAL_URL'])
                    addEnv('KEYCLOAK_REALM', env['KEYCLOAK_REALM'])
                    addEnv('KEYCLOAK_SECRET', env['KEYCLOAK_SECRET'])
                    addEnv('KEYCLOAK_CLIENT_ID', env['KEYCLOAK_CLIENT_ID'])
                }
            }
        }
    }
    else {
        addEnv('NEXT_PUBLIC_AUTH_SYSTEM', 'clerk')
        addEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', env['CLERK_PUBLISHABLE_KEY'])
        addEnv('CLERK_SECRET_KEY', env['CLERK_SECRET_KEY'])
        addEnv('NEXT_PUBLIC_LONG_TOKEN_NAME', 'long-token')
    }

    // TTS
    // Looks for any non disabled option (from the root) that has a non empty "tts" list
    if (!settings.tts?.voices?.length){
        addEnv('NEXT_PUBLIC_HIDE_TTS', 1)
    }

    // Collections - by default disabled
    if (!(settings.collections?.disabled === false)){
        addEnv('NEXT_PUBLIC_HIDE_COLLECTIONS', 1)
    }
    else {
        addEnv('NEXT_PUBLIC_HIDE_COLLECTIONS', 0)
    }

    // Stripe
    if (env['STRIPE_PUBLISHABLE_KEY']){
        addEnv('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', env['STRIPE_PUBLISHABLE_KEY'])
    }

    // Appearance
    if (settings.appearance?.show_signed_out_homepage === true){
        addEnv('NEXT_PUBLIC_HIDE_SIGNED_OUT_HOME_PAGE', 0)
    }
    else {
        addEnv('NEXT_PUBLIC_HIDE_SIGNED_OUT_HOME_PAGE', 1)
    }

    fs.writeFileSync(path.join(__dirname, '../../.env.local'), envContent);
    console.log('Environment variables generated successfully');
} catch (e) {
    console.error('Error generating environment variables:', e);
}
