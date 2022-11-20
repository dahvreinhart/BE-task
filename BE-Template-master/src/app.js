const express = require('express');
const bodyParser = require('body-parser');
const { sequelize } = require('./model')
const { Op } = require("sequelize");
const { getProfile } = require('./middleware/getProfile')
const app = express();
app.use(bodyParser.json());
app.set('sequelize', sequelize)
app.set('models', sequelize.models)

/**
 * Fetch a single contract for a client or contractor by id.
 *
 * @returns Contract
 */
app.get('/contracts/:id', getProfile, async (req, res) => {
    const { Contract } = req.app.get('models');
    const { id } = req.params;

    if (!id) {
        return res.status(404).end();
    }

    // The contract must belong to the requesting user whether they are a client of contractor
    const contract = await Contract.findOne({ where: {
        id,
        [Op.or]: [
            { ClientId: req.profile.id },
            { ContractorId: req.profile.id },
        ],
    }});

    if (!contract) {
        return res.status(404).end();
    }

    res.json(contract);
});

/**
 * Fetch all active, non-terminated contracts for a client or contractor.
 *
 * @returns Contract[]
 */
app.get('/contracts', getProfile, async (req, res) => {
    const { Contract } = req.app.get('models');

    const contracts = await Contract.findAll({ where: {
        status: { [Op.ne]: 'terminated' },
        [Op.or]: [
            { ClientId: req.profile.id },
            { ContractorId: req.profile.id },
        ],
    }});

    res.json(contracts);
});

/**
 * Fetch all unpaid jobs for a client or contractor.
 * Only jobs which are part of active contracts are considered.
 *
 * @returns Job[]
 */
app.get('/jobs/unpaid', getProfile, async (req, res) => {
    const { Contract } = req.app.get('models');
    const { Job } = req.app.get('models');

    const activeContracts = await Contract.findAll({ attributes: ['id'], where: {
        status: { [Op.ne]: 'terminated' },
        [Op.or]: [
            { ClientId: req.profile.id },
            { ContractorId: req.profile.id },
        ],
    }});

    const unpaidJobs = await Job.findAll({ where: {
        ContractId: { [Op.in]: activeContracts.map((ac) => ac.id) },
        [Op.or]: [
            { paid: null },
            { paid: false },
        ],
    }});

    res.json(unpaidJobs);
});

/**
 * As a client, pay a contractor for one of your outstanding jobs.
 *
 * @returns Job
 */
app.post('/jobs/:job_id/pay', getProfile, async (req, res) => {
    const { Job } = req.app.get('models');
    const { Contract } = req.app.get('models');
    const { Profile } = req.app.get('models');

    const { job_id } = req.params;

    if (!job_id) {
        return res.status(404).end();
    }

    if (req.profile.type !== 'client') {
        return res.status(403).end();
    }

    try {
        const updatedJob = await sequelize.transaction(async (transaction) => {
            const jobToPay = await Job.findOne({ where: { id: job_id } }, { lock: true, transaction });

            // Can't find the job, it is already paid, or it has an invalid price
            if (!jobToPay || jobToPay.paid || jobToPay.price < 0) {
                throw Error();
            }

            const associatedContract = await Contract.findOne({ attributes: ['ClientId', 'ContractorId'], where: { id: jobToPay.ContractId } }, { transaction });

            // Can't find the associated contract or the contract is not owned by the requesting client user
            if (!associatedContract || associatedContract.ClientId !== req.profile.id) {
                throw new Error();
            }

            const contractor = await Profile.findOne({ where: { id: associatedContract.ContractorId } }, { lock: true, transaction });

            // Catch find the contractor to pay
            if (!contractor) {
                throw Error();
            }

            const client = await Profile.findOne({ where: { id: req.profile.id } }, { lock: true, transaction });

            // Can't find the client or the client does not have enough money to pay for the job
            if (!client || client.balance < jobToPay.price) {
                throw Error()
            }

            // Transfer the amount of the job price from the client's balance to the contractor's balance and record the action on the job
            client.balance -= jobToPay.price;
            contractor.balance += jobToPay.price;
            jobToPay.paid = true;
            jobToPay.paymentDate = new Date();

            // TODO - if all jobs for a given contact are now paid, does this mean the contract is over and can be marked as terminated?

            // Update all affected entities
            await Promise.all([
                client.save({ transaction }),
                contractor.save({ transaction }),
                jobToPay.save({ transaction }),
            ])

            // Return the update job
            return jobToPay;
        });

        res.json(updatedJob);
    } catch (error) {
        return res.json(error).status(400).end();
    }
});

/**
 * As a client, deposit funds into your balance.
 * A client can deposit, at most, an amount equal to 25% of the total cost of their outstanding jobs.
 * Clients without jobs may not deposit funds.
 *
 * @returns Profile
 */
app.post('/balances/deposit/:userId', getProfile, async (req, res) => {
    const { Job } = req.app.get('models');
    const { Contract } = req.app.get('models');
    const { Profile } = req.app.get('models');

    const { userId } = req.params;
    const { depositAmount } = req.body;

    if (!userId) {
        return res.status(404).end();
    }

    if (!depositAmount || isNaN(depositAmount)) {
        return res.status(400).end();
    }

    // TODO - do we need the "userId" param if the client is simply depositing into their own account?
    if (userId !== `${req.profile.id}`) {
        return res.status(403).end();
    }

    if (req.profile.type !== 'client') {
        return res.status(403).end();
    }

    try {
        const updatedClientProfile = await sequelize.transaction(async (transaction) => {
            const clientContracts = await Contract.findAll({ attributes: ['id'], where: { ClientId: req.profile.id } }, { transaction });

            // No contracts mean no jobs which means this client cannot make a deposit
            if (!clientContracts.length) {
                throw new Error();
            }

            const outstandingClientJobs = await Job.findAll({ attributes: ['price'], where: {
                ContractId: { [Op.in]: clientContracts.map((contract) => contract.id) },
                [Op.or]: [
                    { paid: null },
                    { paid: false },
                ],
            } }, { transaction });

            // No jobs mean this client cannot make a deposit
            if (!outstandingClientJobs.length) {
                throw new Error();
            }

            // This is the maximum amount that the client can deposit at any one time (25% of their total outstanding job costs)
            const maximumDeposit = Object.values(outstandingClientJobs).reduce((totalPrice, job) => totalPrice + job.price, 0) * 0.25;

            // The client is attempting to deposit an illegally high amount
            if (maximumDeposit < depositAmount) {
                throw new Error();
            }

            const client = await Profile.findOne({ where: { id: req.profile.id } }, { lock: true, transaction });

            client.balance += depositAmount;

            await client.save({ transaction });

            return client;
        });

        res.json(updatedClientProfile);
    } catch (error) {
        return res.json(error).status(400).end();
    }
});

/**
 * Computes the highest earning profession(s) for the given date range.
 * Admin only endpoint;
 *
 * @returns string[]
 */
app.get('/admin/best-profession', getProfile, async (req, res) => {
    const { Contract } = req.app.get('models');
    const { Job } = req.app.get('models');
    const { Profile } = req.app.get('models');

    if (req.profile.type !== 'admin') {
        return res.status(403).end();
    }

    const { start, end } = req.query;

    const jobquery = { paid: true };

    let startDate;
    if (start) {
        const startDate = new Date(start);
        if (startDate.toString() === 'Invalid Date') {
            return res.status(400).end();
        }

        jobquery.paymentDate = { [Op.gte]: startDate };
    }

    if (end) {
        const endDate = new Date(end);
        if (endDate.toString() === 'Invalid Date') {
            return res.status(400).end();
        }

        if (startDate) {
            jobquery.paymentDate = {
                [Op.gte]: startDate,
                [Op.lte]: endDate,
            }
        } else {
            jobquery.paymentDate = { [Op.lte]: endDate };
        }
    }

    const jobsPaidInTimeRange = await Job.findAll({ attributes: ['ContractId', 'price'], where: jobquery });

    if (!jobsPaidInTimeRange.length) {
        return res.json([]);
    }

    // Make a map of the contracts and how much, in total has been paid for each one across all its jobs.
    const contractIds = [];
    const contractJobPriceMap = jobsPaidInTimeRange.reduce((map, job) => {
        contractIds.push(job.ContractId);
        map[job.ContractId] = map[job.ContractId]
            ? map[job.ContractId] + job.price
            : job.price;
        return map;
    }, {});

    const relevantContracts = await Contract.findAll({ attributes: ['id', 'ContractorId'], where: { id: { [Op.in]: Array.from(new Set(contractIds)) } } });

    // Make a map of the contractors and how much each of them got paid across all of their contracts.
    const contractorIds = [];
    const contractorPaymentMap = relevantContracts.reduce((map, contract) => {
        contractorIds.push(contract.ContractorId);
        map[contract.ContractorId] = map[contract.ContractorId]
            ? map[contract.ContractorId] + contractJobPriceMap[contract.id]
            : contractJobPriceMap[contract.id];
        return map;
    }, {});

    const relevantContractors = await Profile.findAll({ attributes: ['id', 'profession'], where: { id: {[Op.in]: Array.from(new Set(contractorIds)) } } })

    // Make a map of the professions and how much each earned across all the associated contractors.
    const professionPaymentMap = relevantContractors.reduce((map, contractor) => {
        map[contractor.profession] = map[contractor.profession]
            ? map[contractor.profession] + contractorPaymentMap[contractor.id]
            : contractorPaymentMap[contractor.id];
        return map;
    }, {});

    let highestEarningProfessions = [];
    let professionPaymentCounter = 0;
    for (const [profession, totalAmountPaid] of Object.entries(professionPaymentMap)) {
        if (totalAmountPaid > professionPaymentCounter) {
            professionPaymentCounter = totalAmountPaid;
            highestEarningProfessions = [profession];
        } else if (totalAmountPaid === professionPaymentCounter) {
            highestEarningProfessions.push(profession);
        }
    }

    res.json(highestEarningProfessions);
});

/**
 * Fetch the highest paying clients for the given date range and limit filter.
 * Results are sorted by total payment amount.
 * Admin only endpoint.
 *
 * @returns {
 *     id: number,
 *     fullName: string,
 *     paid: number
 * }
 */
app.get('/admin/best-clients', getProfile, async (req, res) => {
    const { Contract } = req.app.get('models');
    const { Job } = req.app.get('models');
    const { Profile } = req.app.get('models');

    if (req.profile.type !== 'admin') {
        return res.status(403).end();
    }

    const { start, end } = req.query;

    const jobquery = { paid: true };

    let startDate;
    if (start) {
        startDate = new Date(start);
        if (startDate.toString() === 'Invalid Date') {
            return res.status(400).end();
        }

        jobquery.paymentDate = { [Op.gte]: startDate };
    }

    if (end) {
        const endDate = new Date(end);
        if (endDate.toString() === 'Invalid Date') {
            return res.status(400).end();
        }

        if (startDate) {
            jobquery.paymentDate = {
                [Op.gte]: startDate,
                [Op.lte]: endDate,
            }
        } else {
            jobquery.paymentDate = { [Op.lte]: endDate };
        }
    }

    const clientFetchLimit = req.query.limit;
    if (clientFetchLimit && isNaN(clientFetchLimit) || clientFetchLimit < 0) {
        return res.status(400).end();
    } else if (clientFetchLimit === 0) {
        return res.json([]);
    }

    const jobsPaidInTimeRange = await Job.findAll({ attributes: ['ContractId', 'price'], where: jobquery });

    if (!jobsPaidInTimeRange.length) {
        return res.json([]);
    }

    // Make a map of the contracts and how much, in total has been paid for each one across all its jobs.
    const contractIds = [];
    const contractJobPriceMap = jobsPaidInTimeRange.reduce((map, job) => {
        contractIds.push(job.ContractId);
        map[job.ContractId] = map[job.ContractId]
            ? map[job.ContractId] + job.price
            : job.price;
        return map;
    }, {});

    const relevantContracts = await Contract.findAll({ attributes: ['id', 'ClientId'], where: { id: { [Op.in]: Array.from(new Set(contractIds)) } } });

    // Make a map of the contractors and how much each of them got paid across all of their contracts.
    let clientIds = [];
    const clientPaymentMap = relevantContracts.reduce((map, contract) => {
        clientIds.push(contract.ClientId);
        map[contract.ClientId] = map[contract.ClientId]
            ? map[contract.ClientId] + contractJobPriceMap[contract.id]
            : contractJobPriceMap[contract.id];
        return map;
    }, {});

    clientIds.sort((a, b) => clientPaymentMap[a] > clientPaymentMap[b] ? -1 : clientPaymentMap[a] < clientPaymentMap[b] ? 1 : 0);

    const relevantClients = await Profile.findAll({
        attributes: ['id', 'firstName', 'lastName'],
        where: { id: {[Op.in]: Array.from(new Set(clientIds)).slice(0, clientFetchLimit) } }
    });

    res.json(
        relevantClients
            .sort((a, b) => clientPaymentMap[a.id] > clientPaymentMap[b.id] ? -1 : clientPaymentMap[a.id] < clientPaymentMap[b.id] ? 1 : 0)
            .map((rc) => {
                return {
                    id: rc.id,
                    fullName: `${rc.firstName} ${rc.lastName}`,
                    paid: clientPaymentMap[rc.id],
                }
            })
    );
});

module.exports = app;
