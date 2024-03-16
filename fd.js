// Target website
const upstream = 'www.google.com';

// Target website path
const upstream_path = '/';

// Website to be retrieved for users using mobile devices
const upstream_mobile = 'google.com';

// Countries and regions where you wish to suspend service
const blocked_region = [];

// IP addresses to be blocked from using the service
const blocked_ip_address = ['0.0.0.0', '127.0.0.1'];

// Whether the upstream address uses HTTPS protocol
const https = true;

// Whether to disable caching
const disable_cache = false;

// Text replacements
// Format: 'to be replaced': 'replacement'
// Note the comma at the end of the JS
const replace_dict = {
    'www.google.com': 'yourworkername..workers.dev'
};

addEventListener('fetch', event => {
    event.respondWith(fetchAndApply(event.request));
});

async function fetchAndApply(request) {
    const region = request.headers.get('cf-ipcountry').toUpperCase();
    const ip_address = request.headers.get('cf-connecting-ip');
    const user_agent = request.headers.get('user-agent');

    let response = null;
    let url = new URL(request.url);
    let url_hostname = url.hostname;

    if (https == true) {
        url.protocol = 'https:';
    } else {
        url.protocol = 'http:';
    }

    const upstream_domain = await deviceStatus(user_agent) ? upstream : upstream_mobile;

    url.host = upstream_domain;
    url.pathname = url.pathname == '/' ? upstream_path : upstream_path + url.pathname;

    if (blocked_region.includes(region)) {
        response = new Response('Access denied: Service not available in your region!', {
            status: 403
        });
    } else if (blocked_ip_address.includes(ip_address)) {
        response = new Response('Access denied: Your IP address is in the banned list!', {
            status: 403
        });
    } else {
        const method = request.method;
        const request_headers = request.headers;
        const new_request_headers = new Headers(request_headers);

        new_request_headers.set('Host', upstream_domain);
        new_request_headers.set('Referer', url.protocol + '//' + upstream_domain);

        let data = {
            method: method,
            headers: new_request_headers
        };

        if (method === 'POST') {
            data.body = await request.text();
        }

        let original_response = await fetch(url.href, data);

        const connection_upgrade = new_request_headers.get("Upgrade");
        if (connection_upgrade && connection_upgrade.toLowerCase() === "websocket") {
            return original_response;
        }

        let original_response_clone = original_response.clone();
        let original_text = null;
        let response_headers = original_response.headers;
        let new_response_headers = new Headers(response_headers);
        let status = original_response.status;

        if (disable_cache) {
            new_response_headers.set('Cache-Control', 'no-store');
        }

        new_response_headers.set('access-control-allow-origin', '*');
        new_response_headers.set('access-control-allow-credentials', 'true');
        new_response_headers.delete('content-security-policy');
        new_response_headers.delete('content-security-policy-report-only');
        new_response_headers.delete('clear-site-data');

        if (new_response_headers.get("x-pjax-url")) {
            new_response_headers.set("x-pjax-url", response_headers.get("x-pjax-url").replace("//" + upstream_domain, "//" + url_hostname));
        }

        const content_type = new_response_headers.get('content-type');
        if (content_type != null && content_type.includes('text/html') && content_type.includes('UTF-8')) {
            original_text = await replaceResponseText(original_response_clone, upstream_domain, url_hostname);
        } else {
            original_text = original_response_clone.body;
        }

        response = new Response(original_text, {
            status,
            headers: new_response_headers
        });
    }

    return response;
}

async function replaceResponseText(response, upstream_domain, host_name) {
    let text = await response.text();

    for (const [i, j] of Object.entries(replace_dict)) {
        const re = new RegExp(i, 'g');
        text = text.replace(re, j);
    }

    return text;
}

async function deviceStatus(user_agent_info) {
    const agents = ["Android", "iPhone", "SymbianOS", "Windows Phone", "iPad", "iPod"];
    let flag = true;

    for (const agent of agents) {
        if (user_agent_info.indexOf(agent) > 0) {
            flag = false;
            break;
        }
    }

    return flag;
}
