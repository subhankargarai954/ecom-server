// authMiddleware.js

import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

const authMiddleware = (req, res, next) => {
    const TOKEN = req.header("Authorization");
    // console.log(`TOKEN: ${TOKEN}`);
    if (!TOKEN) return res.send({ error: "Access denied" });

    try {
        //If the token is valid, the jwt.verify() function returns the decoded payload (in this case, it likely contains user information such as the user's ID).
        const token = jwt.verify(TOKEN, process.env.JWT_SECRET);
        console.log(`token payload: `);
        console.dir(token, { depth: null });
        req.user = token;

        // const decoded = jwt.verify(token.token, process.env.JWT_SECRET);
        // console.log(`payload: `);
        // console.dir(decoded, { depth: null });
        // req.user = decoded;

        next();
    } catch (error) {
        res.user = undefined;
        console.log(`Invalid token`);
        res.send({ error: "Invalid token" });
    }
};

export { authMiddleware };
