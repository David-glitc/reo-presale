// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./roetoken.sol";

/**
 * @title IROEToken
 * @dev Interface for ROE token transfer functionality
 */
interface IROEToken {
    function transferTokens(address to, uint256 amount) external;
}

/**
 * @title ROEPresale
 * @dev High-performance 3-round presale for ROE token
 */
contract ROEPresale is ReentrancyGuard, Pausable, Ownable {
    uint256 private constant CLAIM_DELAY_DAYS = 3;

    struct Round {
        uint256 price; 
        uint64 startTime;   
        uint64 endTime;    
    }

    IROEToken public immutable token;
    uint256 public immutable softCap;  
    uint256 public immutable hardCap;  
    uint64 public immutable claimStart;
    uint256 public immutable minContribution;
    uint256 public immutable maxContribution;
    uint256 public immutable presaleAllocation;
    uint256 public immutable initialPrice;
    uint256 public immutable priceIncrease;
    
    uint256 public totalRaised;
    Round[3] public rounds;

    mapping(address => uint256) public contributions;
    mapping(address => bool) public claimed;
    mapping(address => mapping(uint8 => uint256)) public roundContributions;

    event TokensPurchased(address indexed buyer, uint256 indexed amountSpent, uint256 indexed tokensBought);
    event TokensClaimed(address indexed user, uint256 indexed amount);
    event Refunded(address indexed user, uint256 indexed amount);

    constructor(
        address _token,
        uint64 startTime,
        uint256 _softCap,
        uint256 _hardCap,
        uint256 _minContribution,
        uint256 _maxContribution,
        uint256 _presaleAllocation
    ) Ownable() {
        require(_token != address(0), "Invalid token address");
        require(_softCap > 0, "Soft cap must be positive");
        require(_hardCap > _softCap, "Hard cap must exceed soft cap");
        require(_minContribution > 0, "Min contribution must be positive");
        require(_maxContribution > _minContribution, "Max contribution must exceed min");
        require(_presaleAllocation > 0, "Presale allocation must be positive");
        require(startTime > block.timestamp, "Start time must be in future");
        
        token = IROEToken(_token);
        softCap = _softCap;
        hardCap = _hardCap;
        claimStart = uint64(startTime + (CLAIM_DELAY_DAYS * 3 days));
        minContribution = _minContribution;
        maxContribution = _maxContribution;
        presaleAllocation = _presaleAllocation;
        initialPrice = 0.5 ether;
        priceIncrease = 110;

        uint64 day1 = startTime + 1 days;
        uint64 day2 = startTime + 2 days;
        uint64 day3 = startTime + 3 days;
        
        rounds[0] = Round(initialPrice, startTime, day1);
        rounds[1] = Round(initialPrice * priceIncrease / 100, day1, day2);
        rounds[2] = Round(initialPrice * priceIncrease * priceIncrease / 10000, day2, day3);
    }

    /**
     * @dev Calculate tokens based on contribution amount and round price
     * @param contribution Amount contributed in wei
     * @param roundIndex Round index (0, 1, or 2)
     * @return tokens Number of tokens to receive
     */
    function _calculateTokens(uint256 contribution, uint8 roundIndex) private view returns (uint256 tokens) {
        require(roundIndex < 3, "Invalid round index");
        
        uint256 price;
        if (roundIndex == 0) price = initialPrice;
        else if (roundIndex == 1) price = initialPrice * priceIncrease / 100;
        else price = initialPrice * priceIncrease * priceIncrease / 10000;
        
        return (contribution * 1e18) / price;
    }

    /**
     * @dev Calculate total tokens for a user across all rounds
     * @param user User address
     * @return totalTokens Total tokens claimable
     */
    function _calculateUserTokens(address user) private view returns (uint256 totalTokens) {
        for (uint8 i = 0; i < 3; i++) {
            uint256 roundContribution = roundContributions[user][i];
            if (roundContribution > 0) {
                totalTokens += _calculateTokens(roundContribution, i);
            }
        }
    }

    function getCurrentRound() public view returns (Round memory) {
        uint256 currentTime = block.timestamp;
        
        if (currentTime >= rounds[0].startTime && currentTime <= rounds[0].endTime) {
            return rounds[0];
        } else if (currentTime >= rounds[1].startTime && currentTime <= rounds[1].endTime) {
            return rounds[1];
        } else if (currentTime >= rounds[2].startTime && currentTime <= rounds[2].endTime) {
            return rounds[2];
        }
        
        revert("No active round");
    }

    function getCurrentRoundIndex() public view returns (uint8 roundIndex) {
        uint256 currentTime = block.timestamp;
        
        if (currentTime >= rounds[0].startTime && currentTime <= rounds[0].endTime) {
            return 0;
        } else if (currentTime >= rounds[1].startTime && currentTime <= rounds[1].endTime) {
            return 1;
        } else if (currentTime >= rounds[2].startTime && currentTime <= rounds[2].endTime) {
            return 2;
        }
        
        revert("No active round");
    }

    modifier onlyWhileActive() {
        require(block.timestamp >= rounds[0].startTime, "Presale not started");
        require(block.timestamp <= rounds[2].endTime, "Presale ended");
        _;
    }

    function buyTokens() external payable nonReentrant onlyWhileActive whenNotPaused {
        // Enhanced sanity checks
        require(msg.value >= minContribution, "Below minimum contribution");
        require(msg.value <= maxContribution, "Exceeds maximum contribution");
        require(contributions[msg.sender] + msg.value <= maxContribution, "Exceeds user limit");
        
        uint256 currentTotalRaised = totalRaised;
        require(currentTotalRaised + msg.value <= hardCap, "Exceeds hard cap");

        uint8 currentRoundIndex = getCurrentRoundIndex();
        uint256 tokens = _calculateTokens(msg.value, currentRoundIndex);
        require(tokens > 0, "Insufficient contribution for tokens");

        // Update state
        contributions[msg.sender] += msg.value;
        roundContributions[msg.sender][currentRoundIndex] += msg.value;
        totalRaised = currentTotalRaised + msg.value;

        emit TokensPurchased(msg.sender, msg.value, tokens);
    }

    function claim() external nonReentrant whenNotPaused {
        require(block.timestamp >= claimStart, "Claim not started");
        require(!claimed[msg.sender], "Already claimed");
        require(totalRaised >= softCap, "Presale failed");

        uint256 amountPaid = contributions[msg.sender];
        require(amountPaid > 0, "No contribution");

        uint256 totalTokens = _calculateUserTokens(msg.sender);
        require(totalTokens > 0, "No tokens to claim");

        claimed[msg.sender] = true;
        token.transferTokens(msg.sender, totalTokens);

        emit TokensClaimed(msg.sender, totalTokens);
    }

    function refund() external nonReentrant whenNotPaused {
        require(block.timestamp >= claimStart, "Presale not ended");
        require(totalRaised < softCap, "Soft cap met");
        require(!claimed[msg.sender], "Already claimed/refunded");

        uint256 amountPaid = contributions[msg.sender];
        require(amountPaid > 0, "No contribution");

        claimed[msg.sender] = true;
        
        (bool success, ) = payable(msg.sender).call{value: amountPaid}("");
        require(success, "Refund failed");

        emit Refunded(msg.sender, amountPaid);
    }

    function withdrawFunds(address payable treasury) external onlyOwner {
        require(block.timestamp >= claimStart, "Not finished");
        require(totalRaised >= softCap, "Presale failed");
        require(treasury != address(0), "Invalid treasury");

        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");

        (bool success, ) = treasury.call{value: balance}("");
        require(success, "Withdraw failed");
    }

    function getClaimableTokens(address user) external view returns (uint256 tokens) {
        if (claimed[user] || contributions[user] == 0 || totalRaised < softCap) {
            return 0;
        }
        
        return _calculateUserTokens(user);
    }

    /**
     * get presale status information
     */
    function getPresaleStatus() external view returns (bool isActive, uint8 currentRound, uint256 timeRemaining) {
        uint256 currentTime = block.timestamp;
        
        if (currentTime < rounds[0].startTime || currentTime > rounds[2].endTime) {
            return (false, 0, 0);
        }
        
        if (currentTime >= rounds[0].startTime && currentTime <= rounds[0].endTime) {
            return (true, 0, rounds[0].endTime - currentTime);
        } else if (currentTime >= rounds[1].startTime && currentTime <= rounds[1].endTime) {
            return (true, 1, rounds[1].endTime - currentTime);
        } else if (currentTime >= rounds[2].startTime && currentTime <= rounds[2].endTime) {
            return (true, 2, rounds[2].endTime - currentTime);
        }
        
        return (false, 0, 0);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Emergency withdraw function to recover funds when paused
     * @param treasury Address to receive the funds
     */
    function emergencyWithdraw(address payable treasury) external onlyOwner whenPaused {
        require(treasury != address(0), "Invalid treasury");
        
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        
        (bool success, ) = treasury.call{value: balance}("");
        require(success, "Emergency withdraw failed");
    }
}
