//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "hardhat/console.sol";

contract WtiaAuction is ReentrancyGuard{
    using SafeERC20 for IERC20;

    /// @dev Keep bidders' detail
    struct Bidder {
        address bidderAddr;
        uint256 totalBidPrice;
        uint256 pricePerToken;
        uint256 requiredTokens;
    }
    
    /// @dev bidder id => Bidder
    mapping(uint256 => Bidder) public bidders;

    /// @dev bidder id
    uint256 public bidderIdTracker;

    /// @dev The initial price
    uint256 startPrice;

    /// @dev The reserve price
    uint256 reservePrice;

    /// @dev The reserve asset
    uint256 reserveAmount;

    /// @dev The block number when this contract is deployed
    uint256 startDate;

    /// @dev Auction period
    uint256 period;

    /// @dev Indicate if this auction has been closed by the seller
    bool isClosedBySeller;

    /// @dev The seller of this auction
    address payable public seller;

    /// @dev The total size of lots that we are selling
    uint256 public totalAmount;
    
    /// @dev flag that represents the status of auction
    bool public isOver;

    /// @dev end price: last bidder's current price
    uint256 endPrice;

    event BidPlaced(address, uint256, uint256);

    event AcutionOpened(address, uint256);

    event AuctionClosed(string);

    event TokenTransferredAndRefunded(address, uint256);

    /**
     * @dev constructor
     * @param _seller address of seller
     * @param _startPrice start price
     * @param _reservePrice reserve price
     * @param _interval auction period from stat date to end date
     */    
    constructor(
        address payable _seller,
        uint256 _reservePrice,
        uint256 _startPrice,
        uint256 _interval
    ) ReentrancyGuard() {
        startPrice = _startPrice;
        reservePrice = _reservePrice;
        startDate = block.timestamp;
        period = _interval;
        seller = _seller;
        
        require(seller != address(0), "POT: invalid seller address");
        require(reservePrice > 0, "POT: invalid reserve price");
        require(startPrice > reservePrice, "POT: invalid start price");
        require(period > 0, "POT: invalid period");
    }
    /// @dev fallback function
    fallback () external { } 

    /**
     * @dev open this acution
     * @param token address of ERC20 token(asset)
     */
    function openAuction(address token, uint256 _totalAmount) external {
        startDate = block.number;
        totalAmount = _totalAmount;
        require(msg.sender == seller, "POT: only seller can open auction");
        require(token != address(0), "POT: invalid token address");
        require(totalAmount > 0, "POT: invalid amount of assets");
        require(
            IERC20(token).balanceOf(msg.sender) >= totalAmount,
            "POT: not enough balance"
        );

        uint256 userBalanceBefore = IERC20(token).balanceOf(msg.sender);
        uint256 serverBalanceBefore = IERC20(token).balanceOf(address(this));

        IERC20(token).safeTransferFrom(msg.sender, address(this), totalAmount);

        uint256 userBalanceAfter = IERC20(token).balanceOf(msg.sender);
        uint256 serverBalanceAfter = IERC20(token).balanceOf(address(this));

        require(
            (userBalanceBefore - userBalanceAfter) == totalAmount &&
            (serverBalanceAfter - serverBalanceBefore) == totalAmount
        );

        emit AcutionOpened(token, totalAmount);
    }

    /// @dev close this auction
    function closeAuction() external {
        require(msg.sender == seller, "POT: only seller can close auction");

        if(!isOver)
            isOver = true;

        emit AuctionClosed("POT: auction is closed by seller.");
    }


    /// @dev Indicate if this auction is still open or not
    function isClosed() public view returns(bool) {
        if (isOver)
            return true;

        if (block.number >= startDate + period)
            return true;

        return false;
    }

    /**
     * @dev return the current price of the goods
     * @param _startPrice start price
     * @param _reservePrice reserve price
     * @param _startDate auction start date
     * @param _endDate auction end date
     * @param currentBlockNumber current time
     */
    function getPrice(
        uint256 _startPrice,
        uint256 _reservePrice,
        uint256 _startDate,
        uint256 _endDate,
        uint256 currentBlockNumber
    ) public pure returns(uint256) {
        require(currentBlockNumber <= _endDate, "POT: You are out of end date");

        uint256 blocks = _endDate - _startDate;
        uint256 elapsedBlocks = currentBlockNumber - _startDate;

        return _startPrice - elapsedBlocks * (_startPrice - _reservePrice) / blocks;
    }

    /**
     * @dev Return the current price of the good
     */
    function getCurrentPrice() public view returns(uint256){
        return getPrice(startPrice, reservePrice, startDate, startDate + period, block.number);
    }

    /**
     * @dev Make a bid request
     * @param bid number of required assets(tokens)
     */
    function makeBid(address token, uint256 bid) payable external {
        require(!isClosed(), "POT: auction is closed.");
        require(bid > 0, "POT: zero amount");

        address recepient = msg.sender;
        uint256 currentPrice = getCurrentPrice();
        require(msg.value == currentPrice * bid, "POT: invalid payment for the bid");

        if (currentPrice < reservePrice) {
            revert("POT: current price is reached to reserve price.");
        } else {
            uint256 userBalanceBefore = IERC20(token).balanceOf(recepient);
            uint256 serverBalanceBefore = IERC20(token).balanceOf(address(this));
            
            IERC20(token).safeTransfer(recepient, bid);

            uint256 userBalanceAfter = IERC20(token).balanceOf(recepient);
            uint256 serverBalanceAfter = IERC20(token).balanceOf(address(this));

            require(
                (userBalanceAfter - userBalanceBefore) == bid &&
                (serverBalanceBefore - serverBalanceAfter) == bid
            );

            emit BidPlaced(msg.sender, currentPrice, msg.value);
        }
    }

}