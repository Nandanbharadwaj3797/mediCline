import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/serverConfig.js";

export const generatejwtToken = (payload) => {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: "1d" });
}

// verify the token
export const verifyjwtToken = (token) => {
    return jwt.verify(token, JWT_SECRET);
}