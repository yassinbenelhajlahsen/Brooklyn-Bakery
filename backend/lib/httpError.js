export function httpError(status, message) {
    return Object.assign(new Error(message), { http: status });
}

export function sendHttpError(res, err, fallbackMessage = 'Internal error') {
    if (err.http) return res.status(err.http).json({ error: err.message });
    return res.status(500).json({ error: fallbackMessage });
}
