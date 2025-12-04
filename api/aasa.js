export default function handler(req, res) {
    res.setHeader("Content-Type", "application/json");
    res.status(200).json({
        webcredentials: {
            apps: [
                "KD6L2PTK2Q.com.grasshopper.dialer",
                "KD6L2PTK2Q.com.grasshopper.passkeys"
            ]
        }
    });
}
