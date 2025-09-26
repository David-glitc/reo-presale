// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./roetoken.sol";

/**
 * @title ROEPresale
 * @notice High-performance 3-round presale for ROE token with optimized gas usage
 */
contract ROEPresale is ReentrancyGuard, Pausable, Ownable {
    // Optimized struct packing - all fields fit in 2 storage slots
    struct Round {
        // price per token (wei)
        uint128 price; 
        // round start timestamp
        uint64 startTime;   
        // round end timestamp
        uint64 endTime;    
        // round active status
        bool active;        
    }

    // Immutable variables for gas optimization
    ROEToken public immutable token;
    // soft cap
    uint256 public immutable softCap;  
    // hard cap
    uint256 public immutable hardCap;  
    // claim start timestamp
    uint64 public immutable claimStart;

    // Storage variables
    // total raised
    uint256 public totalRaised;
    // rounds
    Round[3] public rounds;

    // Packed mappings for gas efficiency
    // contributions
    mapping(address => uint256) public contributions;
    // claimed
    mapping(address => bool) public claimed;
    
    // Track contributions per round for accurate token calculation
    // round contributions
    mapping(address => mapping(uint8 => uint256)) public roundContributions;

    // Optimized events with indexed parameters
    // tokens purchased
    event TokensPurchased(address indexed buyer, uint256 indexed amountSpent, uint256 indexed tokensBought);
    // tokens claimed
    event TokensClaimed(address indexed user, uint256 indexed amount);
    // refunded
    event Refunded(address indexed user, uint256 indexed amount);
    // round updated
    event RoundUpdated(uint8 indexed roundIndex, uint128 indexed newPrice);

    constructor(
        address _token,
        uint64 startTime,
        uint256 _softCap,
        uint256 _hardCap
    ) Ownable() {
        require(_token != address(0), "Invalid token");
        require(_softCap > 0 && _hardCap > _softCap, "Invalid caps");
        
        token = ROEToken(_token);
        softCap = _softCap;
        hardCap = _hardCap;
        claimStart = startTime + 259200; // 3 days = 3 * 24 * 60 * 60 = 259200 seconds

        // Fixed initial price: 0.5 native coin (0.5 * 1e18 wei)
        uint128 initialPrice = 0.5 ether; // 0.5 native coin
        
        // Optimized round initialization with pre-calculated values
        uint64 day1 = startTime + 86400; // 1 day = 24 * 60 * 60 = 86400 seconds
        uint64 day2 = startTime + 172800; // 2 days = 2 * 24 * 60 * 60 = 172800 seconds
        uint64 day3 = startTime + 259200; // 3 days = 3 * 24 * 60 * 60 = 259200 seconds
        
        rounds[0] = Round(initialPrice, startTime, day1, true);
        rounds[1] = Round(uint128((initialPrice * 110) / 100), day1, day2, false);
        rounds[2] = Round(uint128((initialPrice * 110 * 110) / 10000), day2, day3, false);
    }

    modifier onlyWhileActive() {
        require(block.timestamp >= rounds[0].startTime, "Presale not started");
        require(block.timestamp <= rounds[2].endTime, "Presale ended");
        _;
    }

    /**
     * @notice Optimized current round calculation without loops
     * @dev Uses direct timestamp comparison for gas efficiency
     */
    function getCurrentRound() public view returns (Round memory) {
        uint256 currentTime = block.timestamp;
        
        // Direct comparison instead of loop for better gas efficiency
        if (currentTime >= rounds[0].startTime && currentTime <= rounds[0].endTime) {
            return rounds[0];
        } else if (currentTime >= rounds[1].startTime && currentTime <= rounds[1].endTime) {
            return rounds[1];
        } else if (currentTime >= rounds[2].startTime && currentTime <= rounds[2].endTime) {
            return rounds[2];
        }
        
        revert("No active round");
    }

    /**
     * @notice Get current round index for batch operations
     * @return roundIndex Current active round (0, 1, or 2)
     */
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

    /**
     * @notice Optimized token purchase with reduced storage operations
     */
    function buyTokens() external payable nonReentrant onlyWhileActive whenNotPaused {
        require(msg.value > 0, "Zero contribution");
        
        // Cache storage reads for gas optimization
        uint256 currentTotalRaised = totalRaised;
        require(currentTotalRaised + msg.value <= hardCap, "Exceeds hard cap");

        // Get current round price directly without memory allocation
        uint8 currentRoundIndex = getCurrentRoundIndex();
        uint128 currentPrice = rounds[currentRoundIndex].price;
        
        // Calculate tokens with overflow protection
        uint256 tokens = (msg.value * 1e18) / currentPrice;
        require(tokens > 0, "Insufficient contribution");

        // Batch storage updates
        contributions[msg.sender] += msg.value;
        roundContributions[msg.sender][currentRoundIndex] += msg.value;
        totalRaised = currentTotalRaised + msg.value;

        emit TokensPurchased(msg.sender, msg.value, tokens);
    }

    /**
     * @notice Optimized claim function with proper token calculation
     * @dev Calculates tokens based on actual round prices when purchased
     */
    function claim() external nonReentrant whenNotPaused {
        require(block.timestamp >= claimStart, "Claim not started");
        require(!claimed[msg.sender], "Already claimed");
        require(totalRaised >= softCap, "Presale failed");

        uint256 amountPaid = contributions[msg.sender];
        require(amountPaid > 0, "No contribution");

        // Calculate tokens based on actual round prices
        uint256 totalTokens = 0;
        for (uint8 i = 0; i < 3; i++) {
            uint256 roundContribution = roundContributions[msg.sender][i];
            if (roundContribution > 0) {
                totalTokens += (roundContribution * 1e18) / rounds[i].price;
            }
        }

        // Batch storage updates
        claimed[msg.sender] = true;
        token.mint(msg.sender, totalTokens);

        emit TokensClaimed(msg.sender, totalTokens);
    }

    /**
     * @notice Optimized refund function with gas-efficient transfer
     */
    function refund() external nonReentrant whenNotPaused {
        require(block.timestamp >= claimStart, "Presale not ended");
        require(totalRaised < softCap, "Soft cap met");
        require(!claimed[msg.sender], "Already claimed/refunded");

        uint256 amountPaid = contributions[msg.sender];
        require(amountPaid > 0, "No contribution");

        // Batch storage updates
        claimed[msg.sender] = true;
        
        // Use low-level call for gas efficiency
        (bool success, ) = payable(msg.sender).call{value: amountPaid}("");
        require(success, "Refund failed");

        emit Refunded(msg.sender, amountPaid);
    }

    /**
     * @notice Optimized fund withdrawal with gas-efficient transfer
     */
    function withdrawFunds(address payable treasury) external onlyOwner {
        require(block.timestamp >= claimStart, "Not finished");
        require(totalRaised >= softCap, "Presale failed");
        require(treasury != address(0), "Invalid treasury");

        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");

        (bool success, ) = treasury.call{value: balance}("");
        require(success, "Withdraw failed");
    }

    /**
     * @notice Batch purchase function for gas efficiency
     * @dev Allows multiple purchases in a single transaction
     */
    function batchBuyTokens(uint256[] calldata amounts) external payable nonReentrant onlyWhileActive whenNotPaused {
        require(amounts.length > 0, "Empty amounts");
        require(amounts.length <= 10, "Too many purchases"); // Gas limit protection
        
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }
        require(msg.value == totalAmount, "Value mismatch");
        require(totalAmount > 0, "Zero contribution");
        
        // Cache storage reads
        uint256 currentTotalRaised = totalRaised;
        require(currentTotalRaised + totalAmount <= hardCap, "Exceeds hard cap");

        uint8 currentRoundIndex = getCurrentRoundIndex();
        uint128 currentPrice = rounds[currentRoundIndex].price;
        
        uint256 totalTokens = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            uint256 tokens = (amounts[i] * 1e18) / currentPrice;
            totalTokens += tokens;
        }
        require(totalTokens > 0, "Insufficient contribution");

        // Batch storage updates
        contributions[msg.sender] += totalAmount;
        roundContributions[msg.sender][currentRoundIndex] += totalAmount;
        totalRaised = currentTotalRaised + totalAmount;

        emit TokensPurchased(msg.sender, totalAmount, totalTokens);
    }

    /**
     * @notice Get user's claimable token amount
     * @param user Address to check
     * @return tokens Claimable token amount
     */
    function getClaimableTokens(address user) external view returns (uint256 tokens) {
        if (claimed[user] || contributions[user] == 0 || totalRaised < softCap) {
            return 0;
        }
        
        // Calculate tokens based on actual round prices
        uint256 totalTokens = 0;
        for (uint8 i = 0; i < 3; i++) {
            uint256 roundContribution = roundContributions[user][i];
            if (roundContribution > 0) {
                totalTokens += (roundContribution * 1e18) / rounds[i].price;
            }
        }
        return totalTokens;
    }

    /**
     * @notice Get presale status information
     * @return isActive Whether presale is currently active
     * @return currentRound Current round index (0-2)
     * @return timeRemaining Time remaining in current round
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
}
