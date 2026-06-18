// authController.js

import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
dotenv.config();

import { Users } from "../models/index.js";

const signup = async (req, res) => {
    const { name, phone, password, address } = req.body;

    try {
        const phoneExists = await Users.findOne({ where: { phone } });
        if (phoneExists)
            return res.status(400).json({
                error: `Phone number already exists. Please try logging in`,
            });

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await Users.create({
            name,
            phone,
            hashedpassword: hashedPassword,
            address,
        });

        if (!newUser)
            return res.status(500).json({ error: `Unable to register User.` });

        const token = jwt.sign(
            { id: newUser.id, name: newUser.name },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );

        return res.json({
            token,
            message: `Signup successful. Login with phone & password`,
        });
    } catch (error) {
        console.error(`Signup error: ${error.message}`);
        return res.status(500).json({ error: `Unable to register User.` });
    }
};

const login = async (req, res) => {
    const { phone, password } = req.body;

    try {
        const existingUser = await Users.findOne({ where: { phone } });

        if (!existingUser)
            return res.status(401).json({ error: `Phone No not registered` });

        const isMatch = await bcrypt.compare(password, existingUser.hashedpassword);

        if (!isMatch)
            return res.status(401).json({ error: `Incorrect Password` });

        const token = jwt.sign(
            { id: existingUser.id, name: existingUser.name },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );

        return res.json({ token });
    } catch (error) {
        console.error(`Login error: ${error.message}`);
        return res.status(500).json({ error: `Unknown error logging in` });
    }
};

export { signup, login };
