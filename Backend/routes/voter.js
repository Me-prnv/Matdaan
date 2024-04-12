const express = require("express");
const jwt = require('jsonwebtoken');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const Voter = require('../models/voter');
const VoterAddress = require('../models/voter-add');
const CandidateAddress = require('../models/candidate-add');
const Candidate = require('../models/candidate');

const router = express.Router();
router.use(express.json());
router.use(cors());
router.use(cookieParser());


const authMiddleware = async (req, res, next) => {
    try {
        const token = req.headers.token || req.cookies.token;
        console.log('Token:', token);
        const decoded = jwt.verify(token, '$uperman@123');
        console.log('Decoded:', decoded);

        const user = await Voter.findById(decoded._id).catch(err => console.error(err));
        console.log('User:', user);

        if (!user) {
            throw new Error();
        }

        req.user = user;
        next();
    } catch (error) {
        console.error(error);
        res.status(401).send({ error: 'Please authenticate.' });
    }
};

router.post('/signup', async (req, res) => {
    const { firstName, lastName, email, aadharNumber, mobileNumber, password } = req.body;
    try {
        const newVoter = await Voter.create({
            firstName,
            lastName,
            email,
            aadharNumber,
            mobileNumber,
            password,
        });
        return res.status(201).json({ msg: "success", voter: newVoter._id, token: req.cookies.token });
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }
});

router.post("/signin", async (req, res) => {
    const { email, password } = req.body;
    try {
        const token = await Voter.matchPasswordAndGenerateToken(email, password);
        const user = await Voter.getUserByEmail(email);

        // Fetch the VoterAddress
        const voterAddress = await VoterAddress.findOne({ voter: user._id }) || null;

        return res.cookie("token", token).status(201).json({ msg: "success", token, user, voterAddress });
    } catch (error) {
        console.error(error);
        return res.status(301).json({
            error: "Incorrect Email or Password",
        });
    }
});

router.post('/add-voter', authMiddleware, async (req, res) => {
    const { street, city, state, pinCode } = req.body;
    const voterId = req.user._id;

    try {
        const newAddress = await VoterAddress.create({
            voter: voterId,
            street,
            city,
            state,
            pinCode,
        });

        return res.status(201).json({ msg: "Address added successfully", address: newAddress });
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }
});

router.get('/election/:electionType', authMiddleware, async (req, res) => {
    try {
        // Fetch the voter's city
        const voterAddress = await VoterAddress.findOne({ voter: req.user._id });
        const voterCity = voterAddress.city;

        // Fetch the CandidateIds
        const candidateAddresses = await CandidateAddress.find({ city: voterCity });
        const candidateIds = candidateAddresses.map(address => address.candidate);

        // Fetch the entire information from the Candidate schema
        const candidates = await Candidate.find({ _id: { $in: candidateIds }, election: req.params.electionType });

        // Return the fetched information
        return res.status(200).json({ candidates });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
});


router.get('/logout', (req, res) => {
    res.clearCookie("token").redirect("/signin");
});

module.exports = router;