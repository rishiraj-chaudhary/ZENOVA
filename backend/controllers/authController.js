import { validationResult } from 'express-validator'; //validate request body
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/user.js';
import { hashPassword, matchPassword } from '../utils/passwordUtils.js';

//generate a jwt token for the current user
const generateToken = (id) => {
    return jwt.sign({ id, timestamp: Date.now() }, process.env.JWT_SECRET, {
      expiresIn: '30d',
    });
  };

//register user route
export const register = async (req, res) => {
    const { name, email, password } = req.body;
    //valid request body
    const error = validationResult(req);
    if (!error.isEmpty()) {
        return res.status(400).json({ error: error.array() });
    }
    try {
        let existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }
        const hashPass = await hashPassword(password);
        const newUser = new User({
            _id: new mongoose.Types.ObjectId(),
            name,
            email,
            password: hashPass
        });
        await newUser.save();


        const token =  generateToken(newUser._id);
        return res.status(201).json({
            message: 'user registered successfully',
            token,
            user: {
                _id: newUser._id,
                name: newUser.name,
                email: newUser.email
            }
        });
    } catch (err) {
        console.error('Registration error:', err);
        return res.status(500).json({ message: 'Server error', error: err.message });
    }
}

//login user route
export const login = async (req, res,next) => {
    try {
        const { email, password } = req.body;
        const existingUser = await User.findOne({ email });
        
        if (!existingUser) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }
        
        // Check password
        const isMatch = await matchPassword(password, existingUser.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }
        
        // Save existingUser info in session
        req.session.user = {
            _id: existingUser._id,
            name: existingUser.name,
            email: existingUser.email
        };
        const token=generateToken(existingUser._id);
        // Send existingUser data back without password
        const userData = {
            token ,
            _id: existingUser._id,
            name: existingUser.name,
            email: existingUser.email
        };
        
        req.user=existingUser;
        res.status(200).json({ user: userData });
        next();
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

export const logout = (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ message: 'Failed to logout' });
        }
        res.clearCookie('connect.sid');
        res.status(200).json({ message: 'Logged out successfully' });
    });
};

export const checkAuth = (req, res) => {
    if (req.session.user) {
        res.status(200).json({ user: req.session.user });
    } else {
        res.status(401).json({ message: 'Not authenticated' });
    }
};