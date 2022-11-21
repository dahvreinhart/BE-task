const chai = require('chai');
const request = require('supertest');
const { Profile, Contract, Job } = require('../src/model');
const app = require('../src/app');

const expect = chai.expect;
chai.config.includeStack = true;


describe("App Controller Tests", () => {
    before(() => {
        app.listen(3001);
    });

    beforeEach(async () => {
        // Clean DB
        await Profile.sync({ force: true });
        await Contract.sync({ force: true });
        await Job.sync({ force: true });
    });

    after(() => {
        process.exit(1);
    });

    describe("GET /contracts | Fetch all the contracts associated with the provided client or contractor", () => {
        it("should succeed and fetch the contracts associated with a client", async () => {
            const client1 = await Profile.create({
                id: 1,
                firstName: 'test',
                lastName: 'test',
                profession: 'test',
                balance: 1000,
                type: 'client'
            })

            const client2 = await Profile.create({
                id: 2,
                firstName: 'test',
                lastName: 'test',
                profession: 'test',
                balance: 1000,
                type: 'client'
            })

            const contract1 = await Contract.create({
                id: 1,
                terms: 'bla bla bla',
                status: 'in_progress',
                ClientId: client1.id,
                ContractorId: 1,
            });

            await Contract.create({
                id: 2,
                terms: 'bla bla bla',
                status: 'in_progress',
                ClientId: client2.id,
                ContractorId: 1,
            });

            const contract3 = await Contract.create({
                id: 3,
                terms: 'bla bla bla',
                status: 'in_progress',
                ClientId: client1.id,
                ContractorId: 1,
            });

            await request(app)
                .get('/contracts')
                .set('profile_id', client1.id)
                .expect(200)
                .then((res) => {
                    expect(res.body).to.have.length(2);
                    expect(res.body.map((contract) => contract.id)).to.have.members([contract1.id, contract3.id]);
                    expect(res.body.every((contract) => contract.ClientId === client1.id)).to.eq(true);
                });
        });

        it("should succeed and fetch the contracts associated with a contractor", async () => {
            const contractor1 = await Profile.create({
                id: 1,
                firstName: 'test',
                lastName: 'test',
                profession: 'test',
                balance: 1000,
                type: 'contractor'
            })

            const contractor2 = await Profile.create({
                id: 2,
                firstName: 'test',
                lastName: 'test',
                profession: 'test',
                balance: 1000,
                type: 'contractor'
            })

            const contract1 = await Contract.create({
                id: 1,
                terms: 'bla bla bla',
                status: 'in_progress',
                ClientId: 1,
                ContractorId: contractor1.id,
            });

            await Contract.create({
                id: 2,
                terms: 'bla bla bla',
                status: 'in_progress',
                ClientId: 1,
                ContractorId: contractor2.id,
            });

            const contract3 = await Contract.create({
                id: 3,
                terms: 'bla bla bla',
                status: 'in_progress',
                ClientId: 1,
                ContractorId: contractor1.id,
            });

            await request(app)
                .get('/contracts')
                .set('profile_id', contractor1.id)
                .expect(200)
                .then((res) => {
                    expect(res.body).to.have.length(2);
                    expect(res.body.map((contract) => contract.id)).to.have.members([contract1.id, contract3.id]);
                    expect(res.body.every((contract) => contract.ContractorId === contractor1.id)).to.eq(true);
                });
        });

        it("should succeed and return an empty array when no contracts exist for a given client", async () => {
            const client1 = await Profile.create({
                id: 1,
                firstName: 'test',
                lastName: 'test',
                profession: 'test',
                balance: 1000,
                type: 'client'
            })

            await request(app)
                .get('/contracts')
                .set('profile_id', client1.id)
                .expect(200)
                .then((res) => {
                    expect(res.body).to.have.length(0);
                });
        });

        it("should succeed and only return non-terminated contracts for a given contractor", async () => {
            const contractor1 = await Profile.create({
                id: 1,
                firstName: 'test',
                lastName: 'test',
                profession: 'test',
                balance: 1000,
                type: 'contractor'
            })

            const contract1 = await Contract.create({
                id: 1,
                terms: 'bla bla bla',
                status: 'in_progress',
                ClientId: 1,
                ContractorId: contractor1.id,
            });

            await Contract.create({
                id: 2,
                terms: 'bla bla bla',
                status: 'terminated',
                ClientId: 1,
                ContractorId: contractor1.id,
            });

            await request(app)
                .get('/contracts')
                .set('profile_id', contractor1.id)
                .expect(200)
                .then((res) => {
                    expect(res.body).to.have.length(1);
                    expect(res.body[0].id).to.eq(contract1.id);
                    expect(res.body[0].status).to.eq('in_progress');
                });
        });

        it("should fail and return an error for an unauthenticated user", async () => {
            await request(app)
                .get('/contracts')
                .set('profile_id', 12345)
                .expect(401)
        });
    });
});