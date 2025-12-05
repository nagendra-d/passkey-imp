export default function handler(req, res) {
    const body = JSON.stringify({
        webcredentials: {
            apps: [
                "KD6L2PTK2Q.com.grasshopper.dialer",
                "KD6L2PTK2Q.com.grasshopper.passkeys"
            ]
        }
    });

    // Bypass Vercel's JSON helper layer
    res.writeHead(200, {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
    });

    res.end(body);
}
