import pool from "../config/pool.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

import dotenv from "dotenv";
dotenv.config();

const signup = async (req, res) => {
    const { name, phone, password, address } = req.body;

    // if phone already exists or not
    try {
        const phoneExists = await pool.query(
            `select * from users where phone = $1`,
            [phone]
        );

        if (phoneExists.rowCount)
            return res.send({
                error: `Phone number already exists. Please try logging in`,
            });

        // Storing new user data to database
        try {
            const hashedPassword = await bcrypt.hash(password, 10);
            const newUser = await pool.query(
                `insert into users (name, phone, hashedpassword, address) values ($1, $2, $3, $4) returning *`,
                [name, phone, hashedPassword, address]
            );
            if (!newUser.rowCount)
                return res.send({ error: `Unable to register User.` });

            // if new User creation is successful then create a token and sent back
            try {
                const createdUser = newUser.rows[0];
                const token = jwt.sign(
                    { id: createdUser.id, name: createdUser.name },
                    process.env.JWT_SECRET,
                    { expiresIn: "1h" }
                );
                // if token is not generated send an error
                if (!token)
                    return res.send({
                        error: `User registered, token not generated. Try sign in.`,
                    });
                // otherwise sends token and successMessage
                else
                    return res.send({
                        token: token,
                        message: `Signup successful. Login with phone & password`,
                    });
            } catch (error) {
                console.log(`User registered. Token not generated. : ${error}`);
                return res.send({
                    error: `User registered. Token not generated. Try sign in.`,
                });
            }
        } catch (error) {
            console.log(`Unable to register User.: ${error}`);
            return res.send({ error: `Unable to register User.` });
        }
    } catch (error) {
        console.log(`error checking phone number existance: ${error}`);
        return res.send({
            error: `Unable to check phone number`,
        });
    }
};

///////////////////////////////// LOGIN ///////////////////////////////////////////
const login = async (req, res) => {
    const { phone, password } = req.body;

    console.log(`phone:${phone}  password:${password}`);

    try {
        const existingUser = await pool.query(
            `select * from users where phone = $1`,
            [phone]
        );

        if (existingUser.rowCount > 0)
            console.log(`name ${existingUser.rows[0].name}`);

        if (existingUser.rowCount === 0) {
            return res.send({ error: `Phone No not registered` });
        }

        const isMatch = await bcrypt.compare(
            password,
            existingUser.rows[0].hashedpassword
        );

        if (isMatch) {
            dotenv.config();
            console.log(process.env.JWT_SECRET);
            const token = jwt.sign(
                {
                    id: existingUser.rows[0].id,
                    name: existingUser.rows[0].name,
                },
                process.env.JWT_SECRET,
                { expiresIn: "1h" }
            );
            console.log(`token: ${token}`);
            res.json({ token });
        } else {
            return res.send({ error: `Incorrect Password` });
        }
    } catch (error) {
        console.log(`error : ${error}`);
        return res.send({ error: `Unknown error logging in` });
    }
    console.log(`login`);
};

export { signup, login };
