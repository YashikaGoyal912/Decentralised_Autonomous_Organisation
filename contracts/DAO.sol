pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

contract DAO {
    enum Side { Yes, No }
    enum Status{ Undecided, Approved, Rejected }
    struct Proposal {
        address author;
        bytes32 hash;
        uint createdAt;
        uint votesYes;
        uint votesNo;
        Status status;
    }
    mapping(bytes32 => Proposal) public proposals;
    mapping(address => mapping(bytes32 => bool)) public votes;
    mapping(address => uint) public shares;
    uint public totalShares;
    IERC20 public token;
    address public owner;
    uint constant CREATE_PROPOSAL_MIN_SHARE = 100 * 10 ** 18;
    uint constant VOTING_PERIOD = 2 days;

    constructor(address _token) {
        token = IERC20(_token);
        owner = msg.sender;
    }

    function deposit(uint amount) external {
        shares[msg.sender] += amount;
        totalShares += amount;
        token.transferFrom(msg.sender, address(this), amount);
    }

    function withdraw(uint amount) external {
        require(shares[msg.sender] >= amount, 'not enough shares');
        shares[msg.sender] -= amount;
        totalShares -= amount;
        token.transfer(msg.sender, amount);
    }

    function createProposal(bytes32 proposalhash) external {
        require(shares[msg.sender] >= CREATE_PROPOSAL_MIN_SHARE, 'not enough shares to create proposal');
        require(proposals[proposalhash].hash == bytes32(0), 'proposal already exists');
        proposals[proposalhash] = Proposal(
            msg.sender,
            proposalhash,
            block.timestamp,
            0,
            0,
            Status.Undecided
        );
    }

    function vote(bytes32 proposalhash, Side side) external {
        Proposal storage proposal = proposals[proposalhash];
        require(votes[msg.sender][proposalhash] == false, 'already voted');
        require(proposals[proposalhash].hash != bytes32(0), 'proposal does not exist');       
        require(block.timestamp <= proposal.createdAt + VOTING_PERIOD, 'voting period over');
        votes[msg.sender][proposalhash] = true;
        if(side == Side.Yes) {
            proposal.votesYes += shares[msg.sender];
            if(proposal.votesYes * 100 / totalShares >= 50){
                proposal.status = Status.Approved;
            }
        } else {
            proposal.votesNo += shares[msg.sender];
            if(proposal.votesNo * 100 / totalShares >= 50){
                proposal.status = Status.Rejected;
            }
        }
        
    }
}