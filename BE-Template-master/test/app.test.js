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
            });

            const client2 = await Profile.create({
                id: 2,
                firstName: 'test',
                lastName: 'test',
                profession: 'test',
                balance: 1000,
                type: 'client'
            });

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
            });

            const contractor2 = await Profile.create({
                id: 2,
                firstName: 'test',
                lastName: 'test',
                profession: 'test',
                balance: 1000,
                type: 'contractor'
            });

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
            });

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
            });

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
                .expect(401);
        });
    });

    describe("POST /jobs/:job_id/pay | As a client, pay for an outstanding job", () => {
        const seedTestObjectsForJobPaymentTests = async () => {
            const client = await Profile.create({
                id: 1,
                firstName: 'test',
                lastName: 'test',
                profession: 'test',
                balance: 1000,
                type: 'client'
            });

            const contractor = await Profile.create({
                id: 2,
                firstName: 'test',
                lastName: 'test',
                profession: 'test',
                balance: 100,
                type: 'contractor'
            });

            const contract = await Contract.create({
                id: 1,
                terms: 'bla bla bla',
                status: 'in_progress',
                ClientId: client.id,
                ContractorId: contractor.id,
            });

            const job = await Job.create({
                description: 'work',
                price: 500,
                ContractId: contract.id,
            });

            return { client, contractor, contract, job };
        };

        it("should succeed and pay for a job", async () => {
            const { client, contractor, _ , job } = await seedTestObjectsForJobPaymentTests();

            await request(app)
                .post(`/jobs/${job.id}/pay`)
                .set(`profile_id`, client.id)
                .expect(200)
                .then(async (res) => {
                    const updatedJob = await Job.findOne({ where: { id: job.id } });
                    const updatedClient = await Profile.findOne({ where: { id: client.id } });
                    const updatedContractor = await Profile.findOne({ where: { id: contractor.id } });

                    expect(res.body.id).to.eq(job.id).and.to.eq(updatedJob.id);
                    expect(updatedJob.paid).to.eq(true);
                    expect(updatedJob.paymentDate).to.be.a("Date");

                    expect(updatedClient.balance).to.eq(client.balance - job.price);
                    expect(updatedContractor.balance).to.eq(contractor.balance + job.price);
                });
        });

        it("should succeed and pay for a job which has a price of 0", async () => {
            const { client, contractor, job } = await seedTestObjectsForJobPaymentTests();

            job.price = 0;
            await job.save();

            await request(app)
                .post(`/jobs/${job.id}/pay`)
                .set(`profile_id`, client.id)
                .expect(200)
                .then(async (res) => {
                    const updatedJob = await Job.findOne({ where: { id: job.id } });
                    const updatedClient = await Profile.findOne({ where: { id: client.id } });
                    const updatedContractor = await Profile.findOne({ where: { id: contractor.id } });

                    expect(res.body.id).to.eq(job.id).and.to.eq(updatedJob.id);
                    expect(updatedJob.paid).to.eq(true);
                    expect(updatedJob.paymentDate).to.be.a("Date");

                    expect(updatedClient.balance).to.eq(client.balance);
                    expect(updatedContractor.balance).to.eq(contractor.balance);
                });
        });

        it("should fail and return an error when the user is unauthenticated or is not a client", async  () => {
            const { contractor, job } = await seedTestObjectsForJobPaymentTests();

            await request(app)
                .post(`/jobs/${job.id}/pay`)
                .set(`profile_id`, 12345)
                .expect(401);

            await request(app)
                .post(`/jobs/${job.id}/pay`)
                .set(`profile_id`, contractor.id)
                .expect(403);
        });

        it("should fail and return an error when no job id is given", async () => {
            const { client } = await seedTestObjectsForJobPaymentTests();

            await request(app)
                .post(`/jobs/${""}/pay`)
                .set(`profile_id`, client.id)
                .expect(404);
        });

        it("should fail and return an error when the job cannot be found", async () => {
            const { client } = await seedTestObjectsForJobPaymentTests();

            await request(app)
                .post(`/jobs/12345/pay`)
                .set(`profile_id`, client.id)
                .expect(400);
        });

        it("should fail and return an error when the job is already paid", async () => {
            const { client, job } = await seedTestObjectsForJobPaymentTests();

            job.paid = true;
            await job.save();

            await request(app)
                .post(`/jobs/${job.id}/pay`)
                .set(`profile_id`, client.id)
                .expect(400);
        });

        it("should fail and return an error when the job has an invalid price", async () => {
            const { client, job } = await seedTestObjectsForJobPaymentTests();

            job.price = -500;
            await job.save();

            await request(app)
                .post(`/jobs/${job.id}/pay`)
                .set(`profile_id`, client.id)
                .expect(400);
        });

        it("should fail and return an error when the associated contract cannot be found", async () => {
            const { client, contract, job } = await seedTestObjectsForJobPaymentTests();

            await contract.destroy();

            await request(app)
                .post(`/jobs/${job.id}/pay`)
                .set(`profile_id`, client.id)
                .expect(400);
        });

        it("should fail and return an error when the authenticated user is not associated with the contract to which the job belongs", async () => {
            const { job } = await seedTestObjectsForJobPaymentTests();

            const unassociatedClient = await Profile.create({
                id: 3,
                firstName: 'test',
                lastName: 'test',
                profession: 'test',
                balance: 1000,
                type: 'client'
            });

            await request(app)
                .post(`/jobs/${job.id}/pay`)
                .set(`profile_id`, unassociatedClient.id)
                .expect(400);
        });

        it("should fail and return an error when the associated contractor user cannot be found", async () => {
            const { client, contractor, job } = await seedTestObjectsForJobPaymentTests();

            await contractor.destroy();

            await request(app)
                .post(`/jobs/${job.id}/pay`)
                .set(`profile_id`, client.id)
                .expect(400);
        });

        it("should fail and return an error when the client does not have enough money to pay for the job", async () => {
            const { client, job } = await seedTestObjectsForJobPaymentTests();

            client.balance = job.price - 1;
            await client.save();

            await request(app)
                .post(`/jobs/${job.id}/pay`)
                .set(`profile_id`, client.id)
                .expect(400);
        });
    });
});