const { expectRevert } = require("@openzeppelin/test-helpers");
const { web3 } = require("@openzeppelin/test-helpers/src/setup");

const DAO = artifacts.require('DAO.sol');
const GovToken = artifacts.require('GovToken.sol');

contract('DAO', (accounts) => {    
    let dao, govToken;
    const Side = { Yes: 0, No: 1};
    const Status = {
        Undecided : 0 ,
        Approved : 1,
        Rejected : 2
    };
    const [deployer, proposer, voter1, voter2] = [accounts[0], accounts[1], accounts[2], accounts[3]];
    beforeEach( async() => {
        govToken = await GovToken.new();
        dao = await DAO.new(govToken.address, {from: deployer});

        const amount = web3.utils.toWei('3000');
        const seedTokenBalance = async(account) =>{
            await govToken.faucet(account, amount);
            await govToken.approve(dao.address, amount, {from: account});        
        }

        await Promise.all([deployer, proposer, voter1, voter2].map(account => seedTokenBalance(account)));
    });

    it('should deposit Governance Token', async() =>{
        const amount = web3.utils.toWei('1000');
        await dao.deposit(amount, {from: proposer});
        const sharesOfProposer = await dao.shares(proposer);
        const sharesOfVoter1 = await dao.shares(voter1);
        const totalShares = await dao.totalShares();
        assert( sharesOfProposer.toString() === amount);
        assert( totalShares.toString() === amount);
        assert( sharesOfVoter1.toString() === '0');
        console.log( sharesOfProposer.toString());
        console.log( totalShares.toString());
        console.log( sharesOfVoter1.toString());
    });

    it('should be able to withdraw if drawer has enough shares', async() =>{
        await dao.deposit(web3.utils.toWei('1000'), {from: proposer});
        await dao.withdraw( web3.utils.toWei('600'), {from: proposer});
        const sharesOfProposer = await dao.shares(proposer);
        const totalShares = await dao.totalShares();        
        assert( sharesOfProposer.toString() === web3.utils.toWei('400'));
        assert( totalShares.toString() === web3.utils.toWei('400'));
        console.log( sharesOfProposer.toString());
        console.log( totalShares.toString());
    });

    it('should NOT be able to withdraw if drawer doesnt have enough shares', async() =>{
        await expectRevert(
            dao.withdraw(web3.utils.toWei('600'), {from: proposer}),
            'not enough shares'
        );
        await expectRevert(
            dao.withdraw(web3.utils.toWei('600'), {from: voter1}),
            'not enough shares'
        );
    });

    it('should create a proposal', async() =>{
        await dao.deposit(web3.utils.toWei('200'), {from: proposer});
        const proposal = '000001';
        const proposalHash = await web3.utils.asciiToHex(proposal);
        await dao.createProposal(proposalHash, {from: proposer});
        const Proposal1 = await dao.proposals(proposalHash);
        assert(Proposal1.author === proposer);
        assert(Proposal1.votesYes.toString() === '0' );
        assert(Proposal1.votesNo.toString() === '0' );
        assert(Proposal1.status.toNumber() === Status.Undecided );
    });

    it('should NOT create a proposal if not enough shares available to create a proposal', async() =>{
        await dao.deposit(web3.utils.toWei('10'), {from: deployer});
        const proposal = '000001';
        const proposalHash = await web3.utils.asciiToHex(proposal);
        await expectRevert(
            dao.createProposal(proposalHash, {from: deployer}),
            "not enough shares to create proposal"
        );
    });

    it('should NOT create a proposal if proposal already exists', async() => {
        await dao.deposit(web3.utils.toWei('200'), {from: proposer});
        const proposal = '000001';
        const proposalHash = await web3.utils.asciiToHex(proposal);
        await dao.createProposal(proposalHash, {from: proposer});
        
        await dao.deposit(web3.utils.toWei('300'), {from: deployer});
        await expectRevert(
            dao.createProposal(proposalHash, {from: deployer}),
            "proposal already exists"
        );
    });

    it.only('should be able to vote', async() => {
        await dao.deposit(web3.utils.toWei('200'), {from: proposer});
        await dao.deposit(web3.utils.toWei('100'), {from: deployer});
        await dao.deposit(web3.utils.toWei('300'), {from: voter1});
        await dao.deposit(web3.utils.toWei('400'), {from: voter2});        
        const proposal = '000001';
        const proposalHash = await web3.utils.asciiToHex(proposal);
        await dao.createProposal(proposalHash, {from: proposer});
        await dao.vote(proposalHash, Side.Yes, {from: proposer});
        await dao.vote(proposalHash, Side.Yes, {from: deployer});
        await dao.vote(proposalHash, Side.Yes, {from: voter1});
        await dao.vote(proposalHash, Side.No, {from: voter2});
        const Proposal1 = await dao.proposals(proposalHash);
        const proposerVote = await dao.votes(proposer, proposalHash);
        const deployerVote = await dao.votes(deployer, proposalHash);
        const voter1Vote = await dao.votes(voter1, proposalHash);
        const voter2Vote = await dao.votes(voter2, proposalHash);
        assert(proposerVote === true);
        assert(deployerVote === true);
        assert(voter1Vote === true);
        assert(voter2Vote === true);
        assert(Proposal1.votesYes.toString() === web3.utils.toWei('600'));
        assert(Proposal1.votesNo.toString() === web3.utils.toWei('400'));
        assert(Proposal1.status.toNumber() === Status.Approved);
    });

    it('should NOT be able to vote if already voted', async() => {
        await dao.deposit(web3.utils.toWei('200'), {from: proposer});
        await dao.deposit(web3.utils.toWei('300'), {from: voter1});
        const proposal = '000001';
        const proposalHash = await web3.utils.asciiToHex(proposal);
        await dao.createProposal(proposalHash, {from: proposer});
        await dao.vote(proposalHash, Side.Yes, {from: proposer});
        await dao.vote(proposalHash, Side.Yes, {from: voter1});
        await expectRevert(
            dao.vote(proposalHash, Side.Yes, {from: voter1}),
            "already voted"
        );
    });

    it('should NOT be able to vote if proposal doesnot exist', async() =>{
        await dao.deposit(web3.utils.toWei('200'), {from: proposer});
        await dao.deposit(web3.utils.toWei('300'), {from: voter1});
        const proposal = '000001';
        const proposalHash = await web3.utils.asciiToHex(proposal);
        await expectRevert(
            dao.vote(proposalHash, Side.Yes, {from: proposer}),
            'proposal does not exist'
        );
    });

    //-----------Change voting period to 2 seconds for testing ------------------
    // it('should NOT be able to vote if voting period is over', async() => {
    //     await dao.deposit(web3.utils.toWei('200'), {from: proposer});
    //     const proposal = '000001';
    //     const proposalHash = await web3.utils.asciiToHex(proposal);
    //     await dao.createProposal(proposalHash, {from: proposer});
    //     await new Promise(resolve => setTimeout(resolve, 2500));
    //     await expectRevert(
    //         dao.vote(proposalHash, Side.Yes, {from: proposer}),
    //         "voting period over"
    //     );
    // });
    
})