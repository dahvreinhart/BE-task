# EDIT FROM DAHV:
Thank you for reviewing my coding challenge submission! :)

Overall, I found the challenge engaging and enjoyable.
I, of course, didn't have enough time to do everything I wanted to do.
So I will elaborate on what my immediate next steps would have been had time not been a factor:
- Populate all errors with messages/codes
- Refactor project to a more modular structure with different modules for each model type and separate exposed interfaces for each model's actions
- Implement a service level and refactor a bit to reuse more common code
- Refactor successive DB calls for admin stats endpoints to use subqueries and try to do as much in the DB
- Use prettier or similar and lint the code
- Extend tests for all actions
- Implement some test util functions to help deduplicate test seeding code and assertions etc
- Improve test startup and teardown vis-a-vis the tmp db and object cleaning

I also noticed that concurrency is a topic which is important here.
To this end I implemented several applicable concepts for the logic concerned with updating models:
- All models are now versioned meaning they will be protected against race conditions updating outdated information at the DB level
- Logic which updates models (the two POST endpoints) are transationed meaning all reading and writing occures with SQL transactions - updates are only commited if no intermediate erros are encountered
- Logic which updtes models (the two POST endpoints) use DB locks for objects to be updated locking the specific rows for these objects, thus, not allowing intermediate updates on the tables during these critical times

Lastly, I implemented some tests for some endpoints.
These can be run with `npm run test`.

Again, thank you for your time reviewing my code.
If you have any questions please do not hesitate to reach out.

---


# DEEL BACKEND TASK

  

💫 Welcome! 🎉


This backend exercise involves building a Node.js/Express.js app that will serve a REST API. We imagine you should spend around 3 hours at implement this feature.

## Data Models

> **All models are defined in src/model.js**

### Profile
A profile can be either a `client` or a `contractor`. 
clients create contracts with contractors. contractor does jobs for clients and get paid.
Each profile has a balance property.

### Contract
A contract between and client and a contractor.
Contracts have 3 statuses, `new`, `in_progress`, `terminated`. contracts are considered active only when in status `in_progress`
Contracts group jobs within them.

### Job
contractor get paid for jobs by clients under a certain contract.

## Getting Set Up

  
The exercise requires [Node.js](https://nodejs.org/en/) to be installed. We recommend using the LTS version.

  

1. Start by cloning this repository.

  

2. In the repo root directory, run `npm install` to gather all dependencies.

  

3. Next, `npm run seed` will seed the local SQLite database. **Warning: This will drop the database if it exists**. The database lives in a local file `database.sqlite3`.

  

4. Then run `npm start` which should start both the server and the React client.

  

❗️ **Make sure you commit all changes to the master branch!**

  
  

## Technical Notes

  

- The server is running with [nodemon](https://nodemon.io/) which will automatically restart for you when you modify and save a file.

- The database provider is SQLite, which will store data in a file local to your repository called `database.sqlite3`. The ORM [Sequelize](http://docs.sequelizejs.com/) is on top of it. You should only have to interact with Sequelize - **please spend some time reading sequelize documentation before starting the exercise.**

- To authenticate users use the `getProfile` middleware that is located under src/middleware/getProfile.js. users are authenticated by passing `profile_id` in the request header. after a user is authenticated his profile will be available under `req.profile`. make sure only users that are on the contract can access their contracts.
- The server is running on port 3001.

  

## APIs To Implement 

  

Below is a list of the required API's for the application.

  


1. ***GET*** `/contracts/:id` - This API is broken 😵! it should return the contract only if it belongs to the profile calling. better fix that!

1. ***GET*** `/contracts` - Returns a list of contracts belonging to a user (client or contractor), the list should only contain non terminated contracts.

1. ***GET*** `/jobs/unpaid` -  Get all unpaid jobs for a user (***either*** a client or contractor), for ***active contracts only***.

1. ***POST*** `/jobs/:job_id/pay` - Pay for a job, a client can only pay if his balance >= the amount to pay. The amount should be moved from the client's balance to the contractor balance.

1. ***POST*** `/balances/deposit/:userId` - Deposits money into the the the balance of a client, a client can't deposit more than 25% his total of jobs to pay. (at the deposit moment)

1. ***GET*** `/admin/best-profession?start=<date>&end=<date>` - Returns the profession that earned the most money (sum of jobs paid) for any contactor that worked in the query time range.

1. ***GET*** `/admin/best-clients?start=<date>&end=<date>&limit=<integer>` - returns the clients the paid the most for jobs in the query time period. limit query parameter should be applied, default limit is 2.
```
 [
    {
        "id": 1,
        "fullName": "Reece Moyer",
        "paid" : 100.3
    },
    {
        "id": 200,
        "fullName": "Debora Martin",
        "paid" : 99
    },
    {
        "id": 22,
        "fullName": "Debora Martin",
        "paid" : 21
    }
]
```

  

## Going Above and Beyond the Requirements

Given the time expectations of this exercise, we don't expect anyone to submit anything super fancy, but if you find yourself with extra time, any extra credit item(s) that showcase your unique strengths would be awesome! 🙌

It would be great for example if you'd write some unit test / simple frontend demostrating calls to your fresh APIs.

  

## Submitting the Assignment

When you have finished the assignment, create a github repository and send us the link.

  

Thank you and good luck! 🙏
