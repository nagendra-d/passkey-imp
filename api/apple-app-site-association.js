export default function handler(req, res) {
    res.setHeader("Content-Type", "application/json");
    res.status(200).send(JSON.stringify({
        webcredentials: {
            apps: [
                "KD6L2PTK2Q.com.grasshopper.dialer",
                "KD6L2PTK2Q.com.grasshopper.passkeys"
            ]
        }
    }));
}
