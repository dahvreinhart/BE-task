const express = require('express');
const bodyParser = require('body-parser');
const { sequelize } = require('./model')
const { getProfile } = require('./middleware/getProfile')
const app = express();
app.use(bodyParser.json());
app.set('sequelize', sequelize)
app.set('models', sequelize.models)

/**
 * Fetch a single contract for a client or contractor by id.
 *
 * @returns contract by id
 */
app.get('/contracts/:id', getProfile, async (req, res) => {
    const { Contract } = req.app.get('models');
    const { id } = req.params;

    if (!id) {
        return res.status(404).end();
    }

    const contract = await Contract.findOne({ where: { id } });

    // Ensure that only the client or contractor profiles which this contract belongs to can fetch it
    if (![contract.ClientId, contract.ContractorId].includes(req.profile.id)) {
        return res.status(403).end();
    }

    if (!contract) {
        return res.status(404).end();
    }

    res.json(contract);
})

module.exports = app;
