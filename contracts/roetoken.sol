// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ROEToken
 * @dev ERC20 token with pre-minted supply for presale transfers
 */
contract ROEToken is ERC20, Ownable {
    address public presale;
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 10**18; // 1B tokens

    modifier onlyPresale() {
        require(msg.sender == presale, "Not presale contract");
        _;
    }

    constructor() ERC20("ROE Token", "ROE") Ownable() {
        _mint(msg.sender, TOTAL_SUPPLY);
    }

    function setPresale(address _presale) external onlyOwner {
        require(_presale != address(0), "Invalid address");
        require(presale == address(0), "Presale already set");
        presale = _presale;
    }

    function transferTokens(address to, uint256 amount) external onlyPresale {
        _transfer(msg.sender, to, amount);
    }
}